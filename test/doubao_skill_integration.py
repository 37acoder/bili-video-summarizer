"""Local transport/packaged-CLI integration checks; no paid service or real key.

Run after npm run build:skill. Optional DOUBAO_TEST_SOURCE_CLI exercises an
installed newer CLI without replacing its bundle. aiohttp/certifi are required.
Synthetic ASR output tests plumbing, not recognition quality.
"""
import argparse
import asyncio
import contextlib
import gzip
import importlib.util
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

from aiohttp import web

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("doubao", ROOT / "scripts/doubao-transcribe.py")
doubao = importlib.util.module_from_spec(spec)
spec.loader.exec_module(doubao)
CLI = Path(os.environ.get("DOUBAO_TEST_SOURCE_CLI", ROOT / "skills/video-summarizer/scripts/video-source.cjs"))
FAKE_KEY = "integration-only-not-a-real-secret"


def response():
    rows = [{"text": "合成测试文字用于验证长句分块。" * 45, "start_time": 0, "end_time": 900,
             "definite": True, "words": [{"text": "合成", "start_time": 0, "end_time": 100}],
             "additions": {"speaker_id": "0", "emotion": "neutral", "gender": "female",
                           "speech_rate": "3.1", "volume": "70", "lid_lang": "speech_mand",
                           "future_field": {"keep": True}}},
            {"text": "第二位说话人的合成测试句子。", "start_time": 1000, "end_time": 1999,
             "definite": True, "words": [], "additions": {"speaker_id": "1", "emotion": "happy"}}]
    return {"code": 0, "is_last_package": True,
            "payload_msg": {"audio_info": {"duration": 2000},
                            "result": {"text": "".join(r["text"] for r in rows), "utterances": rows}}}


def wire(body, last=False):
    data = gzip.compress(json.dumps(body).encode())
    return bytes([0x11, 0x93 if last else 0x91, 0x11, 0]) + struct.pack(">iI", -1 if last else 1, len(data)) + data


class Workflow(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="doubao-integration-")
        self.root = Path(self.temporary.name)
        self.audio = self.root / "input.wav"
        with wave.open(str(self.audio), "wb") as wav:
            wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            wav.writeframes(b"\0\0" * 32000)
        self.calls = 0
        self.audio_packets = 0
        self.requests = []
        self.mode = "success"
        self.protocol_errors = []
        app = web.Application()
        app.router.add_get("/asr", self.server)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, "127.0.0.1", 0)
        await site.start()
        self.endpoint = f"ws://127.0.0.1:{site._server.sockets[0].getsockname()[1]}/asr"
        self.patches = [patch.object(doubao, "ENDPOINT", self.endpoint),
                        patch.dict(os.environ, {"DOUBAO_ASR_API_KEY": FAKE_KEY})]
        for p in self.patches:
            p.start()

    async def asyncTearDown(self):
        for p in self.patches:
            p.stop()
        await self.runner.cleanup()
        self.temporary.cleanup()

    async def server(self, request):
        self.calls += 1
        if self.mode == "denied":
            return web.Response(status=403)
        socket = web.WebSocketResponse()
        await socket.prepare(request)
        try:
            assert request.headers["X-Api-Key"] == FAKE_KEY
            assert request.headers["X-Api-Resource-Id"] == doubao.RESOURCE
            first = (await socket.receive()).data
            assert first[:4] == bytes([0x11, 0x11, 0x11, 0])
            sequence, length = struct.unpack(">iI", first[4:12])
            assert sequence == 1 and length == len(first[12:])
            self.requests.append(json.loads(gzip.decompress(first[12:])))
            await socket.send_bytes(wire({"result": {"text": ""}}))
            received = b""
            next_sequence = 2
            async for message in socket:
                data = message.data
                last = data[1] & 15 == 3
                assert data[1] >> 4 == 2 and data[2] == 0x11
                seq, length = struct.unpack(">iI", data[4:12])
                assert seq == (-next_sequence if last else next_sequence)
                assert length == len(data[12:])
                received += gzip.decompress(data[12:])
                self.audio_packets += 1
                next_sequence += 1
                if last:
                    assert received == self.audio.read_bytes()
                    if self.mode == "success":
                        # A provisional update must not duplicate final text.
                        await socket.send_bytes(wire({"result": {"text": "临时更新"}}))
                        await socket.send_bytes(wire(response()["payload_msg"], last=True))
                    break
        except Exception as error:
            self.protocol_errors.append(type(error).__name__ + ": " + str(error))
        await socket.close()
        return socket

    def args(self, name, **changes):
        return argparse.Namespace(audio=self.audio, source_cli=CLI, out=self.root / name,
                                  cache_dir=self.root / "cache", source="bilibili", video_id="BV12ftJ6rEkw",
                                  title="保留的原标题", page=2, language="auto", chunk_tokens=128,
                                  credential_file=self.root / "missing-key.json", tail_timeout=5,
                                  ffmpeg="ffmpeg", node="node", retry=False, import_response=None, **changes)

    async def run_prepare(self, args):
        with contextlib.redirect_stderr(io.StringIO()) as progress:
            result = await asyncio.to_thread(doubao.prepare, args)
        self.assertNotIn(FAKE_KEY, progress.getvalue())
        return result

    def check_job(self, job):
        manifest = json.loads((job / "manifest.json").read_text())
        self.assertGreater(manifest["chunkCount"], 2)
        self.assertEqual(manifest["title"], "保留的原标题")
        self.assertEqual(manifest["provenance"]["source"]["pageNumber"], 2)
        self.assertTrue((job / "asr/complete.json").is_file())
        raw = json.loads((job / "asr/doubao-response.json").read_text())
        self.assertEqual(raw, response())
        self.assertTrue(raw["payload_msg"]["result"]["utterances"][0]["additions"]["future_field"]["keep"])
        seen, text = set(), ""
        for c in manifest["chunks"]:
            block = json.loads((job / c["file"]).read_text())
            self.assertLessEqual(c["estimatedFileTokens"], 128)
            companion = json.loads((job / c["asrMetadataFile"]).read_text())
            for item in block["items"]:
                matches = [u for u in companion["utterances"] if u["firstItemIndex"] <= item["index"] <= u["lastItemIndex"]]
                self.assertEqual(len(matches), 1)
                u = matches[0]
                original = response()["payload_msg"]["result"]["utterances"][u["utteranceIndex"]]
                self.assertEqual(u["additions"]["speaker_id"], original["additions"]["speaker_id"])
                self.assertEqual((u["s"], u["e"]), (original["start_time"] / 1000, original["end_time"] / 1000))
                seen.add(u["utteranceIndex"])
                text += item["text"]
        self.assertEqual(seen, {0, 1})
        self.assertEqual(text, response()["payload_msg"]["result"]["text"])
        for file in self.root.rglob("*.json"):
            self.assertNotIn(FAKE_KEY, file.read_text())
        return manifest

    async def test_stream_rich_chunks_cache_and_offline_import(self):
        original_hash = doubao.sha256(self.audio)
        result = await self.run_prepare(self.args("first"))
        self.assertFalse(result["cached"])
        self.check_job(self.root / "first")
        self.assertEqual(self.requests[0]["request"], doubao.PARAMETERS)
        self.assertTrue(all(self.requests[0]["request"][n] for n in (
            "enable_speaker_info", "enable_emotion_detection", "enable_gender_detection",
            "show_speech_rate", "show_volume", "enable_lid", "enable_nonstream")))
        with patch.dict(os.environ, {"DOUBAO_ASR_API_KEY": ""}):
            result = await self.run_prepare(self.args("cached"))
        self.assertTrue(result["cached"])
        self.check_job(self.root / "cached")
        self.assertEqual(self.calls, 1)
        imported = self.root / "import.json"
        imported.write_text(json.dumps(response()))
        args = self.args("imported")
        args.import_response = imported
        await self.run_prepare(args)
        manifest = self.check_job(self.root / "imported")
        self.assertTrue(manifest["provenance"]["imported"])
        self.assertIsNone(manifest["provenance"]["requestId"])
        self.assertEqual(self.calls, 1)
        self.assertEqual(doubao.sha256(self.audio), original_hash)
        inspected = subprocess.run([sys.executable, str(ROOT / "scripts/doubao-transcribe.py"),
                                   "inspect", "--job", str(self.root / "first"), "--chunk", "0001", "--limit", "1"],
                                  capture_output=True, check=True, text=True)
        self.assertEqual(len(json.loads(inspected.stdout)["utterances"]), 1)
        self.assertFalse(self.protocol_errors, self.protocol_errors)

    async def test_denied_before_audio_never_retries_implicitly(self):
        self.mode = "denied"
        with self.assertRaisesRegex(doubao.Failure, "AUTH_OR_SERVICE_DENIED"):
            await self.run_prepare(self.args("denied"))
        state = json.loads(next((self.root / "cache").rglob("attempt.json")).read_text())
        self.assertEqual(state["status"], "rejected_before_audio")
        self.assertEqual(state["audio_packets_sent"], 0)
        self.assertFalse((self.root / "denied").exists())
        with self.assertRaisesRegex(doubao.Failure, "PREVIOUS_ATTEMPT"):
            await self.run_prepare(self.args("different-out"))
        self.assertEqual(self.calls, 1)
        self.mode = "success"
        args = self.args("retry")
        args.retry = True
        await self.run_prepare(args)
        self.assertEqual(self.calls, 2)

    async def test_incomplete_stream_cannot_become_completed_or_reuploaded(self):
        self.mode = "incomplete"
        with self.assertRaisesRegex(doubao.Failure, "TERMINAL_RESPONSE_MISSING"):
            await self.run_prepare(self.args("partial"))
        state = json.loads(next((self.root / "cache").rglob("attempt.json")).read_text())
        self.assertEqual(state["status"], "incomplete_outcome_unknown")
        self.assertGreater(state["audio_packets_sent"], 0)
        self.assertFalse(list((self.root / "cache").rglob("complete.json")))
        with self.assertRaisesRegex(doubao.Failure, "PREVIOUS_ATTEMPT"):
            await self.run_prepare(self.args("other-out"))
        self.assertEqual(self.calls, 1)

    async def test_selected_bilibili_download_cleans_cookie_and_signed_info(self):
        cookie_value = "fake-bili-cookie-only"
        config = self.root / "bili.json"
        config.write_text(json.dumps({"SESSDATA": cookie_value}))
        args = argparse.Namespace(video="https://www.bilibili.com/video/BV12ftJ6rEkw/?p=2",
                                  out=self.root / "download", auth_file=str(config), yt_dlp="mock-yt-dlp", ffprobe="mock-ffprobe")
        stages = []
        def api(request, **kwargs):
            self.assertEqual(request.headers["Cookie"], "SESSDATA=" + cookie_value)
            self.assertTrue(request.full_url.startswith("https://api.bilibili.com/"))
            value = {"isLogin": True} if request.full_url.endswith("/nav") else {
                "title": "保留的原标题", "pages": [{"page": 1, "duration": 99, "cid": 123},
                                                {"page": 2, "duration": 2, "cid": 456}]}
            return io.BytesIO(json.dumps({"code": 0, "data": value}).encode())
        def media(command, timeout=600):
            if command[0] == "mock-ffprobe":
                return "2.0\n"
            stage = Path(command[command.index("-o") + 1]).parent
            stages.append(stage)
            cookie = Path(command[command.index("--cookies") + 1])
            self.assertEqual(cookie.stat().st_mode & 0o777, 0o600)
            self.assertNotIn(cookie_value, " ".join(command))
            self.assertTrue(command[-1].endswith("/?p=2"))
            (stage / "audio.wav").write_bytes(self.audio.read_bytes())
            (stage / "audio.info.json").write_text(json.dumps({"id": "456", "ext": "wav",
                "title": "被下载器改写的标题", "duration": 2, "url": "https://signed.invalid/?secret=hidden"}))
            return ""
        with patch.dict(os.environ, {"BILIBILI_SESSION_TOKEN": ""}), \
             patch.object(doubao.urllib.request, "urlopen", api), patch.object(doubao, "tool", media):
            value = doubao.download_audio(args)
        self.assertEqual(value["title"], "保留的原标题")
        self.assertEqual(value["pageNumber"], 2)
        self.assertEqual(value["cid"], 456)
        self.assertEqual(doubao.sha256(Path(value["audio"])), doubao.sha256(self.audio))
        self.assertTrue(all(not s.exists() for s in stages))
        self.assertEqual({p.name for p in args.out.iterdir()}, {"audio.wav", "audio-source.json"})
        metadata = (args.out / "audio-source.json").read_text()
        self.assertNotIn(cookie_value, metadata)
        self.assertNotIn("signed.invalid", metadata)


if __name__ == "__main__":
    unittest.main(verbosity=2)
