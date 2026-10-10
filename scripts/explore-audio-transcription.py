#!/usr/bin/env python3
"""Research-only: audio download -> whisper.cpp -> existing prepare CLI.

Requires yt-dlp, ffmpeg, ffprobe, whisper-cli, Node >=22 and a local GGML model.
Does not change the production caption path or install/download models.
"""
import argparse
import json
import math
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--model', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--language', default='zh')
    parser.add_argument('--cookies', type=Path, help='Optional private Netscape cookie file')
    args = parser.parse_args()
    url = urlparse(args.video)
    if url.scheme not in ('http', 'https') or url.hostname not in ('www.bilibili.com', 'bilibili.com', 'www.youtube.com', 'youtube.com', 'youtu.be'):
        raise ValueError('UNSUPPORTED_VIDEO_URL')
    model = args.model.expanduser().resolve(strict=True)
    if not model.is_file():
        raise ValueError('MODEL_NOT_A_FILE')
    for tool in ('yt-dlp', 'ffmpeg', 'ffprobe', 'whisper-cli', 'node'):
        if not shutil.which(tool):
            raise ValueError('MISSING_TOOL: ' + tool)
    out = args.out.expanduser().resolve()
    out.mkdir(mode=0o700, parents=False, exist_ok=False)
    metrics = {'status': 'running', 'modelFile': model.name, 'language': args.language,
               'stagesSeconds': {}}
    stage = 'download'

    def run(name, command, timeout):
        started = time.monotonic()
        with (out / (name + '.log')).open('w') as log:
            subprocess.run(command, stdout=log, stderr=subprocess.STDOUT,
                           timeout=timeout, check=True)
        metrics['stagesSeconds'][name] = round(time.monotonic() - started, 3)
        print(json.dumps({'completed': name, 'seconds': metrics['stagesSeconds'][name]}), flush=True)

    try:
        command = ['yt-dlp', '--ignore-config', '--no-playlist', '--retries', '1',
                   '--socket-timeout', '30', '-f', 'bestaudio', '--write-info-json',
                   '-o', str(out / 'audio.%(ext)s')]
        if args.cookies:
            command += ['--cookies', str(args.cookies.expanduser().resolve(strict=True))]
        run(stage, command + ['--', args.video], 600)
        info_path = out / 'audio.info.json'
        info = json.loads(info_path.read_text())
        # Do not retain signed CDN URLs, headers or a full platform response.
        info_path.unlink()
        metadata = {key: info.get(key) for key in ('id', 'title', 'duration', 'webpage_url', 'extractor_key')}
        (out / 'video.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2))
        source = 'bilibili' if 'bilibili' in str(info.get('extractor_key', '')).lower() else 'youtube'
        audio = out / ('audio.' + info['ext'])
        stage = 'normalize'
        wav = out / 'audio-16k.wav'
        run(stage, ['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error',
                    '-i', str(audio), '-vn', '-ar', '16000', '-ac', '1',
                    '-c:a', 'pcm_s16le', str(wav)], 600)
        duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
            'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(wav)], text=True))
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError('INVALID_AUDIO_DURATION')
        metrics['audioDurationSeconds'] = duration
        stage = 'transcribe'
        run(stage, ['whisper-cli', '-m', str(model), '-f', str(wav), '-l', args.language,
                    '-oj', '-osrt', '-otxt', '-of', str(out / 'whisper')], 7200)
        result = json.loads((out / 'whisper.json').read_text())
        items = []
        last_start = -1
        for segment in result['transcription']:
            text = segment['text'].strip()
            start = float(segment['offsets']['from']) / 1000
            end = float(segment['offsets']['to']) / 1000
            if not all(math.isfinite(n) for n in (start, end)) or start < last_start or start < 0 or end < start or end > duration + 1:
                raise ValueError('INVALID_ASR_TIMESTAMPS')
            last_start = start
            if text:
                items.append({'index': len(items), 's': start, 'text': text})
        if not items:
            raise ValueError('EMPTY_ASR_TRANSCRIPT')
        transcript = {'title': info['title'], 'videoId': info['id'], 'source': source,
            'subtitlesArray': items, 'transcriptText': ' '.join(i['text'] for i in items),
            'usedDescription': False, 'asrProvenance': {'kind': 'local-asr', 'engine': 'whisper.cpp',
                'model': model.name, 'language': args.language, 'audioDurationSeconds': duration}}
        transcript_path = out / 'transcript.json'
        transcript_path.write_text(json.dumps(transcript, ensure_ascii=False, indent=2))
        stage = 'prepare'
        cli = Path(__file__).resolve().parents[1] / 'skills/video-summarizer/scripts/video-source.cjs'
        run(stage, ['node', str(cli), 'prepare', '--transcript', str(transcript_path),
                    '--out', str(out / 'prepared')], 120)
        metrics.update(status='complete', itemCount=len(items),
                       lastSpeechStartSeconds=items[-1]['s'],
                       audioBytes=audio.stat().st_size, wavBytes=wav.stat().st_size,
                       manifest=str(out / 'prepared/manifest.json'))
        print(json.dumps(metrics), flush=True)
    except (Exception, KeyboardInterrupt) as error:
        metrics.update(status='cancelled' if isinstance(error, KeyboardInterrupt) else 'failed', failedStage=stage)
        raise
    finally:
        (out / 'metrics.json').write_text(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        # Tool logs remain private: do not print command arguments/cookie paths.
        print(json.dumps({'error': type(error).__name__, 'detail': 'See output stage log; existing output directories are rejected.'}), file=sys.stderr)
        sys.exit(1)
