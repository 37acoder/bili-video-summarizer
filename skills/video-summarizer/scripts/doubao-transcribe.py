#!/usr/bin/env python3
"""Optional Doubao ASR 2.0 skill helper. Never prints credentials or transcript bodies.

Uses one streaming session (internally two-pass) and retains the final rich response.
Python 3.9+; aiohttp and certifi are needed only for an uncached cloud request.
"""
import argparse
import asyncio
import gzip
import hashlib
import importlib.util
import json
import math
import os
import signal
import shutil
import ssl
import struct
import subprocess
import sys
import tempfile
import time
import uuid
import wave
import re
import urllib.parse
import urllib.request
from pathlib import Path

ENDPOINT = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async"
RESOURCE = "volc.seedasr.sauc.duration"
VERSION = "doubao-rich-v1"
CONFIG = Path.home() / ".config/video-summarizer/doubao.json"
CACHE = Path.home() / ".cache/video-summarizer/doubao"
PARAMETERS = {
    "model_name": "bigmodel", "enable_nonstream": True,
    "enable_itn": True, "enable_punc": True, "enable_ddc": False,
    "show_utterances": True, "enable_speaker_info": True,
    "enable_emotion_detection": True, "enable_gender_detection": True,
    "show_speech_rate": True, "show_volume": True, "enable_lid": True,
    "result_type": "full",
}
VIEW_FIELDS = ("speaker_id", "emotion", "emotion_degree", "emotion_score",
               "emotion_degree_score", "gender", "gender_score", "speech_rate",
               "volume", "lid_lang", "lid_lang_score", "source", "invoke_type")


class Failure(Exception):
    pass


def private_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf8") as output:
            os.chmod(temporary, 0o600)
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def read_key(path):
    key = os.environ.get("DOUBAO_ASR_API_KEY")
    if not key:
        try:
            config = json.loads(path.read_text())
            key = config.get("api_key")
            if key == config.get("name"):
                raise Failure("DOUBAO_KEY_INVALID")
        except FileNotFoundError:
            raise Failure("DOUBAO_KEY_MISSING")
        except (ValueError, AttributeError):
            raise Failure("DOUBAO_CONFIG_INVALID")
    if not isinstance(key, str) or not key.strip() or "*" in key or any(c.isspace() for c in key):
        raise Failure("DOUBAO_KEY_INVALID")
    return key


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def tool(command, timeout=600):
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                check=False, timeout=timeout)
        if result.returncode:
            raise Failure("DOUBAO_MEDIA_TOOL_FAILED")
        return result.stdout.decode("utf8")
    except FileNotFoundError:
        raise Failure("DOUBAO_MEDIA_TOOL_MISSING")
    except subprocess.TimeoutExpired:
        raise Failure("DOUBAO_MEDIA_TOOL_TIMEOUT")


def audio_info(path):
    try:
        with wave.open(str(path), "rb") as audio:
            if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) != (16000, 1, 2):
                return None
            seconds = audio.getnframes() / 16000
            if seconds <= 0 or not math.isfinite(seconds):
                raise Failure("DOUBAO_INVALID_AUDIO")
            return seconds
    except (wave.Error, EOFError):
        return None


def download_audio(args):
    """Download only a selected audio track; signed info and cookies live in private staging."""
    parsed = urllib.parse.urlparse(args.video)
    host = parsed.hostname or ""
    page = 1
    if host in ("www.bilibili.com", "bilibili.com"):
        match = re.fullmatch(r"/video/(BV[a-zA-Z0-9]{10}|av\d+)/?", parsed.path)
        if not match:
            raise Failure("DOUBAO_VIDEO_URL_INVALID")
        source, video_id = "bilibili", match.group(1)
        page = int(urllib.parse.parse_qs(parsed.query).get("p", ["1"])[0])
        if page < 1:
            raise Failure("DOUBAO_VIDEO_URL_INVALID")
        url = f"https://www.bilibili.com/video/{video_id}/?p={page}"
    elif host in ("www.youtube.com", "youtube.com", "youtu.be"):
        video_id = parsed.path[1:] if host == "youtu.be" else urllib.parse.parse_qs(parsed.query).get("v", [""])[0]
        if not re.fullmatch(r"[a-zA-Z0-9_-]{11}", video_id):
            raise Failure("DOUBAO_VIDEO_URL_INVALID")
        source, url = "youtube", f"https://www.youtube.com/watch?v={video_id}"
    else:
        raise Failure("DOUBAO_VIDEO_URL_INVALID")
    out = Path(args.out).resolve()
    if out.exists() or not out.parent.is_dir():
        raise Failure("DOUBAO_OUTPUT_EXISTS_OR_PARENT_MISSING")
    expected = None
    original_title = None
    cid = None
    with tempfile.TemporaryDirectory(prefix=".doubao-download-", dir=out.parent) as directory:
        stage = Path(directory)
        command = [args.yt_dlp, "--ignore-config", "--no-playlist", "--retries", "1", "--socket-timeout", "30",
                   "-f", "bestaudio", "--write-info-json", "-o", str(stage / "audio.%(ext)s")]
        if source == "bilibili":
            token = os.environ.get("BILIBILI_SESSION_TOKEN")
            if not token:
                try:
                    token = json.loads(Path(args.auth_file).expanduser().read_text())["SESSDATA"]
                except (FileNotFoundError, KeyError, ValueError):
                    raise Failure("DOUBAO_BILIBILI_AUTH_REQUIRED")
            if not isinstance(token, str) or not token or any(c.isspace() or c == ";" for c in token):
                raise Failure("DOUBAO_BILIBILI_AUTH_INVALID")
            import certifi
            context = ssl.create_default_context(cafile=certifi.where())
            def api(path):
                request = urllib.request.Request("https://api.bilibili.com" + path,
                    headers={"Cookie": "SESSDATA=" + token, "User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com/"})
                with urllib.request.urlopen(request, context=context, timeout=20) as response:
                    value = json.load(response)
                if value.get("code") != 0:
                    raise Failure("DOUBAO_BILIBILI_API_FAILED")
                return value["data"]
            if not api("/x/web-interface/nav").get("isLogin"):
                raise Failure("DOUBAO_BILIBILI_AUTH_INVALID")
            view = api("/x/web-interface/view?" + urllib.parse.urlencode(
                {"bvid": video_id} if video_id.startswith("BV") else {"aid": video_id[2:]}))
            selected = next((p for p in view.get("pages", []) if p.get("page") == page), None)
            if selected is None:
                raise Failure("DOUBAO_PAGE_NOT_FOUND")
            expected, original_title, cid = selected["duration"], view["title"], selected["cid"]
            cookie = stage / "cookies.txt"
            cookie.write_text("# Netscape HTTP Cookie File\n.bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\t" + token + "\n")
            cookie.chmod(0o600)
            command += ["--cookies", str(cookie)]
        tool(command + ["--", url])
        info = json.loads((stage / "audio.info.json").read_text())
        extension = info.get("ext", "")
        if not re.fullmatch(r"[a-zA-Z0-9]+", extension):
            raise Failure("DOUBAO_INVALID_AUDIO")
        if source == "youtube" and info.get("id") != video_id:
            raise Failure("DOUBAO_VIDEO_ID_MISMATCH")
        if source == "bilibili":
            identity = str(info.get("id", ""))
            if identity not in (video_id, str(cid), f"{video_id}_{cid}"):
                raise Failure("DOUBAO_VIDEO_ID_MISMATCH")
            if page > 1:
                info_page = urllib.parse.parse_qs(urllib.parse.urlparse(info.get("webpage_url", "")).query).get("p", [])
                if info_page != [str(page)] and identity not in (str(cid), f"{video_id}_{cid}"):
                    raise Failure("DOUBAO_PAGE_UNVERIFIED")
        audio = stage / ("audio." + extension)
        seconds = float(tool([args.ffprobe, "-v", "error", "-show_entries", "format=duration",
                              "-of", "default=noprint_wrappers=1:nokey=1", str(audio)]).strip())
        expected = expected if expected is not None else info.get("duration")
        if not math.isfinite(seconds) or seconds <= 0 or expected is None or abs(seconds - float(expected)) > max(3, float(expected) * .01):
            raise Failure("DOUBAO_DURATION_MISMATCH")
        metadata = {"source": source, "videoId": video_id, "pageNumber": page, "cid": cid,
                    "title": original_title or info.get("title") or video_id,
                    "durationSeconds": seconds, "audioSha256": sha256(audio), "url": url}
        out.mkdir(mode=0o700)
        shutil.move(str(audio), str(out / audio.name))
        private_json(out / "audio-source.json", metadata)
        return {"audio": str(out / audio.name), "metadata": str(out / "audio-source.json"), **metadata}


def packet(payload, sequence, audio=False, last=False):
    compressed = gzip.compress(payload)
    flags = 3 if last else 1
    header = bytes([0x11, ((2 if audio else 1) << 4) | flags, 0x11, 0])
    return header + struct.pack(">iI", -sequence if last else sequence, len(compressed)) + compressed


def parse_packet(data):
    if len(data) < 8 or data[0] >> 4 != 1:
        raise Failure("DOUBAO_PROTOCOL_INVALID")
    kind, flags = data[1] >> 4, data[1] & 15
    cursor = (data[0] & 15) * 4
    if kind not in (9, 15) or cursor < 4:
        raise Failure("DOUBAO_PROTOCOL_INVALID")
    if flags & 1:
        cursor += 4
    if flags & 4:
        cursor += 4
    code = 0
    if kind == 15:
        code = struct.unpack_from(">I", data, cursor)[0]
        cursor += 4
    length = struct.unpack_from(">I", data, cursor)[0]
    body = data[cursor + 4:]
    if len(body) != length:
        raise Failure("DOUBAO_PROTOCOL_INVALID")
    if data[2] & 15 == 1:
        body = gzip.decompress(body)
    elif data[2] & 15 != 0:
        raise Failure("DOUBAO_PROTOCOL_INVALID")
    if data[2] >> 4 != 1:
        raise Failure("DOUBAO_PROTOCOL_INVALID")
    return {"code": code, "is_last_package": bool(flags & 2), "payload_msg": json.loads(body)}


def validate(response, seconds):
    if response.get("code") != 0 or response.get("is_last_package") is not True:
        raise Failure("DOUBAO_RESULT_NOT_FINAL")
    body = response.get("payload_msg", {})
    duration = body.get("audio_info", {}).get("duration")
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or abs(duration / 1000 - seconds) > max(1, seconds * .01):
        raise Failure("DOUBAO_DURATION_MISMATCH")
    result = body.get("result", {})
    utterances = result.get("utterances")
    if not isinstance(result.get("text"), str) or not result["text"].strip() or not isinstance(utterances, list) or not utterances:
        raise Failure("DOUBAO_TRANSCRIPT_EMPTY")
    previous = -1
    for item in utterances:
        start, end = item.get("start_time"), item.get("end_time")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not all(math.isfinite(x) for x in (start, end)):
            raise Failure("DOUBAO_TIMESTAMPS_INVALID")
        if start < previous or start < 0 or end < start or end > seconds * 1000 + 1000 or item.get("definite") is not True:
            raise Failure("DOUBAO_TIMESTAMPS_INVALID")
        if not isinstance(item.get("text"), str) or not isinstance(item.get("additions", {}), dict):
            raise Failure("DOUBAO_RESULT_INVALID")
        previous = start
    return body


async def recognize(audio, key, request, request_id, state_path, seconds):
    import aiohttp
    import certifi
    headers = {"X-Api-Key": key, "X-Api-Resource-Id": RESOURCE, "X-Api-Request-Id": request_id}
    connector = aiohttp.TCPConnector(ssl=ssl.create_default_context(cafile=certifi.where()))
    state = {"status": "connecting", "request_id": request_id, "audio_packets_sent": 0}
    private_json(state_path, state)
    async with aiohttp.ClientSession(connector=connector) as session:
        try:
            connection = await asyncio.wait_for(session.ws_connect(ENDPOINT, headers=headers,
                                                 max_msg_size=64 * 1024 * 1024), timeout=30)
        except aiohttp.WSServerHandshakeError as error:
            state.update(status="rejected_before_audio", http_status=error.status)
            private_json(state_path, state)
            raise Failure("DOUBAO_AUTH_OR_SERVICE_DENIED" if error.status in (401, 403) else "DOUBAO_HANDSHAKE_FAILED")
        async with connection:
            await connection.send_bytes(packet(json.dumps(request).encode(), 1))
            first = await connection.receive(timeout=30)
            if first.type != aiohttp.WSMsgType.BINARY or parse_packet(first.data)["code"] != 0:
                raise Failure("DOUBAO_REQUEST_REJECTED")
            state.update(status="streaming")
            private_json(state_path, state)

            async def send():
                with audio.open("rb") as source:
                    sequence = 2
                    current = source.read(6400)
                    deadline = time.monotonic()
                    while current:
                        following = source.read(6400)
                        await connection.send_bytes(packet(current, sequence, audio=True, last=not following))
                        state["audio_packets_sent"] += 1
                        sequence += 1
                        deadline += .2
                        await asyncio.sleep(max(0, deadline - time.monotonic()))
                        current = following

            sender = asyncio.create_task(send())
            # Sender failures immediately interrupt the receiver rather than hanging until timeout.
            async def receive():
                async for message in connection:
                    if message.type != aiohttp.WSMsgType.BINARY:
                        raise Failure("DOUBAO_CONNECTION_INTERRUPTED")
                    row = parse_packet(message.data)
                    if row["code"]:
                        raise Failure("DOUBAO_RECOGNITION_FAILED")
                    if row["is_last_package"]:
                        return row
                raise Failure("DOUBAO_TERMINAL_RESPONSE_MISSING")

            receiver = asyncio.create_task(receive())
            try:
                done, _ = await asyncio.wait((sender, receiver), return_when=asyncio.FIRST_COMPLETED)
                if sender in done:
                    await sender
                final = await receiver
                validate(final, seconds)
                return final
            finally:
                sender.cancel()
                receiver.cancel()
                await asyncio.gather(sender, receiver, return_exceptions=True)
                private_json(state_path, state)


def export_job(args, response, seconds, audio_hash, request, request_id, cached):
    body = validate(response, seconds)
    original = body["result"]["utterances"]
    items = []
    for index, utterance in enumerate(original):
        if utterance["text"].strip():
            items.append({"index": len(items), "text": utterance["text"],
                          "s": utterance["start_time"] / 1000, "e": utterance["end_time"] / 1000,
                          "asrUtteranceIndex": index})
    if not items:
        raise Failure("DOUBAO_TRANSCRIPT_EMPTY")
    provenance = {"kind": "cloud-asr", "provider": "doubao", "resourceId": RESOURCE,
                  "requestId": request_id, "audioSha256": audio_hash, "audioDurationSeconds": seconds,
                  "cached": cached, "source": {"source": args.source, "videoId": args.video_id,
                  "pageNumber": args.page}, "adapterVersion": VERSION,
                  "imported": request is None,
                  "logId": body.get("result", {}).get("additions", {}).get("log_id")}
    transcript = {"title": args.title, "source": args.source, "videoId": args.video_id,
                  "usedDescription": False, "subtitlesArray": items,
                  "transcriptText": body["result"]["text"]}
    with tempfile.TemporaryDirectory(prefix=".doubao-prepare-", dir=args.out.parent) as temporary:
        input_file = Path(temporary) / "transcript.json"
        private_json(input_file, transcript)
        tool([args.node, str(args.source_cli), "prepare", "--transcript", str(input_file),
              "--out", str(args.out), "--chunk-tokens", str(args.chunk_tokens)], timeout=60)
    # Existing CLIs treat an incoming `transcription` as local Whisper artifacts.
    # Attach cloud provenance after preparation so both CLI versions remain usable.
    prepared_transcript = json.loads((args.out / "transcript.json").read_text())
    prepared_transcript["cloudTranscription"] = provenance
    private_json(args.out / "transcript.json", prepared_transcript)
    asr = args.out / "asr"
    private_json(asr / "doubao-response.json", response)
    private_json(asr / "doubao-request.json", {"endpoint": ENDPOINT, "resourceId": RESOURCE,
                                               "requestId": request_id, "payload": request})
    manifest_path = args.out / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["provenance"] = provenance
    # Align actual split chunk items with source utterances; never assume their reindexed IDs match.
    cursor, consumed = 0, 0
    for chunk in manifest["chunks"]:
        chunk_body = json.loads((args.out / chunk["file"]).read_text())
        groups = []
        for piece in chunk_body["items"]:
            if cursor >= len(items):
                raise Failure("DOUBAO_CHUNK_ALIGNMENT_FAILED")
            source = items[cursor]
            text = piece["text"]
            if source["text"][consumed:consumed + len(text)] != text or piece.get("s") != source["s"]:
                raise Failure("DOUBAO_CHUNK_ALIGNMENT_FAILED")
            uindex = source["asrUtteranceIndex"]
            if not groups or groups[-1]["utteranceIndex"] != uindex:
                additions = original[uindex].get("additions", {})
                groups.append({"utteranceIndex": uindex, "firstItemIndex": piece["index"],
                               "lastItemIndex": piece["index"], "s": source["s"], "e": source["e"],
                               "additions": {k: additions[k] for k in VIEW_FIELDS if k in additions}})
            else:
                groups[-1]["lastItemIndex"] = piece["index"]
            consumed += len(text)
            if consumed == len(source["text"]):
                cursor += 1
                consumed = 0
        rich_file = f"asr/chunks/{chunk['id']}.json"
        private_json(args.out / rich_file, {"chunkId": chunk["id"], "utterances": groups})
        chunk["asrMetadataFile"] = rich_file
    if cursor != len(items) or consumed:
        raise Failure("DOUBAO_CHUNK_ALIGNMENT_FAILED")
    private_json(manifest_path, manifest)
    private_json(asr / "complete.json", {**provenance, "status": "complete", "utteranceCount": len(original),
                                         "wordCount": sum(len(u.get("words", [])) for u in original)})
    return {"manifest": str(manifest_path), "chunkCount": manifest["chunkCount"],
            "provider": "doubao", "cached": cached, "usedDescription": False}


def prepare(args):
    args.out = Path(args.out).resolve()
    args.audio = Path(args.audio).resolve()
    args.source_cli = Path(args.source_cli).resolve()
    if args.out.exists() or not args.out.parent.is_dir():
        raise Failure("DOUBAO_OUTPUT_EXISTS_OR_PARENT_MISSING")
    if not args.audio.is_file() or not args.source_cli.is_file() or not 128 <= args.chunk_tokens <= 16000:
        raise Failure("DOUBAO_INPUT_INVALID")
    cache_root = Path(args.cache_dir).expanduser().resolve()
    cache_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Normalize only into an owned temporary directory, never replace/delete the input.
    with tempfile.TemporaryDirectory(prefix=".normalize-", dir=cache_root) as temporary:
        audio = args.audio
        seconds = audio_info(audio)
        if seconds is None:
            audio = Path(temporary) / "audio.wav"
            tool([args.ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(args.audio),
                  "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(audio)])
            seconds = audio_info(audio)
        if seconds is None or seconds > 5 * 3600:
            raise Failure("DOUBAO_INVALID_AUDIO")
        audio_hash = sha256(audio)
        request = {"user": {"uid": "video-summarizer"},
                   "audio": {"format": "wav", "codec": "raw", "rate": 16000, "bits": 16,
                             "channel": 1, **({"language": "zh-CN"} if args.language == "zh-CN" else {})},
                   "request": PARAMETERS.copy()}
        cache_id = hashlib.sha256(json.dumps([VERSION, RESOURCE, audio_hash, request], sort_keys=True).encode()).hexdigest()
        cache = cache_root / cache_id
        cache.mkdir(exist_ok=True, mode=0o700)
        lock = cache / ".lock"
        try:
            descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            raise Failure("DOUBAO_BUSY: verify owner before removing a stale lock")
        os.write(descriptor, str(os.getpid()).encode())
        os.close(descriptor)
        try:
            response = None
            marker = cache / "complete.json"
            if marker.exists() and not args.import_response:
                try:
                    cached_marker = json.loads(marker.read_text())
                    if sha256(cache / "response.json") != cached_marker["responseSha256"]:
                        raise Failure("DOUBAO_CACHE_INVALID")
                    response = json.loads((cache / "response.json").read_text())
                    validate(response, seconds)
                    request_id = cached_marker["requestId"]
                except (ValueError, KeyError, OSError):
                    raise Failure("DOUBAO_CACHE_INVALID")
            cached = response is not None
            if not cached:
                request_id = str(uuid.uuid4())
                if args.import_response:
                    response = json.loads(Path(args.import_response).read_text())
                    validate(response, seconds)
                    request_id = None
                    # Imported responses are never seeded into the cloud cache: their settings are unknown.
                    return export_job(args, response, seconds, audio_hash, None, request_id, False)
                key = read_key(Path(args.credential_file).expanduser())
                missing = [name for name in ("aiohttp", "certifi") if importlib.util.find_spec(name) is None]
                if missing:
                    raise Failure("DOUBAO_PYTHON_DEPENDENCIES_MISSING")
                attempt = cache / "attempt.json"
                if attempt.exists() and not args.retry:
                    raise Failure("DOUBAO_PREVIOUS_ATTEMPT: inspect attempt.json; explicit --retry may repeat billing")
                started = time.monotonic()
                print(json.dumps({"progress": "doubao-transcribe", "audioSeconds": seconds,
                                  "requestId": request_id}), file=sys.stderr, flush=True)
                try:
                    response = asyncio.run(asyncio.wait_for(recognize(audio, key, request, request_id, attempt, seconds),
                                                           timeout=seconds + args.tail_timeout))
                except BaseException:
                    if attempt.exists():
                        state = json.loads(attempt.read_text())
                        if state["status"] != "rejected_before_audio":
                            state["status"] = "incomplete_outcome_unknown"
                        private_json(attempt, state)
                    raise
                print(json.dumps({"progress": "doubao-complete", "seconds": round(time.monotonic() - started, 3)}),
                      file=sys.stderr, flush=True)
                private_json(cache / "response.json", response)
                private_json(marker, {"requestId": request_id, "responseSha256": sha256(cache / "response.json")})
            return export_job(args, response, seconds, audio_hash, request, request_id, cached)
        finally:
            lock.unlink(missing_ok=True)


def main():
    def stop(signum, frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, stop)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    doctor = commands.add_parser("doctor", help="Check optional dependencies and key presence without networking")
    doctor.add_argument("--credential-file", default=str(CONFIG))
    download = commands.add_parser("download", help="Download a selected Bilibili/YouTube audio track; no cloud call")
    download.add_argument("--video", required=True)
    download.add_argument("--out", required=True)
    download.add_argument("--auth-file", default=str(Path.home() / ".config/video-summarizer/bilibili.json"))
    download.add_argument("--yt-dlp", default="yt-dlp")
    download.add_argument("--ffprobe", default="ffprobe")
    run = commands.add_parser("prepare", help="Transcribe an already selected audio track and prepare summary chunks")
    for name in ("audio", "title", "source", "video-id", "out"):
        run.add_argument("--" + name, required=True, **({"choices": ["bilibili", "youtube"]} if name == "source" else {}))
    run.add_argument("--page", type=int, default=1)
    run.add_argument("--source-cli", default=str(Path(__file__).resolve().with_name("video-source.cjs")))
    run.add_argument("--credential-file", default=str(CONFIG))
    run.add_argument("--cache-dir", default=str(CACHE))
    run.add_argument("--language", choices=["auto", "zh-CN"], default="auto")
    run.add_argument("--chunk-tokens", type=int, default=3000)
    run.add_argument("--tail-timeout", type=int, default=120)
    run.add_argument("--ffmpeg", default="ffmpeg")
    run.add_argument("--node", default="node")
    run.add_argument("--retry", action="store_true", help="Explicitly restart an incomplete paid session")
    run.add_argument("--import-response", help="Offline import of an existing terminal response; no key/network")
    inspect = commands.add_parser("inspect", help="Read bounded rich metadata for one prepared text chunk")
    inspect.add_argument("--job", required=True)
    inspect.add_argument("--chunk", required=True)
    inspect.add_argument("--offset", type=int, default=0)
    inspect.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    try:
        if args.command == "doctor":
            try:
                read_key(Path(args.credential_file).expanduser())
                configured = True
            except Failure:
                configured = False
            missing = [n for n in ("aiohttp", "certifi") if importlib.util.find_spec(n) is None]
            result = {"ready": configured and not missing, "keyConfigured": configured, "missingPythonPackages": missing,
                      "ffmpegAvailable": bool(shutil.which("ffmpeg")), "nodeAvailable": bool(shutil.which("node")),
                      "resourceId": RESOURCE, "serviceActivation": "verify separately; no network request made"}
        elif args.command == "download":
            result = download_audio(args)
        elif args.command == "inspect":
            if args.offset < 0 or not 1 <= args.limit <= 20 or not args.chunk.isdigit():
                raise Failure("DOUBAO_INVALID_METADATA_PAGE")
            value = json.loads((Path(args.job) / "asr/chunks" / (args.chunk + ".json")).read_text())
            rows = value["utterances"]
            result = {"chunkId": value["chunkId"], "offset": args.offset, "utterances": rows[args.offset:args.offset + args.limit],
                      "nextOffset": args.offset + args.limit if args.offset + args.limit < len(rows) else None}
        else:
            if args.page < 1 or args.tail_timeout < 1:
                raise Failure("DOUBAO_INPUT_INVALID")
            result = prepare(args)
        print(json.dumps(result, ensure_ascii=False))
    except Failure as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        print(json.dumps({"error": "DOUBAO_CANCELLED: partial upload may have been billed"}), file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(json.dumps({"error": "DOUBAO_OPERATION_FAILED", "type": type(error).__name__}), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
