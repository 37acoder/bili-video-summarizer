import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SummarizeError } from '../errors'
import { privateJson } from '../agent/auth'
import type { ResolvedSubtitleConfig } from '../config'
import type { CommonSubtitleItem, SummarizeInput, TranscriptResult } from '../types'
import type { LocalTranscriptionOptions } from './types'
import { doctorLocalTranscription, fingerprint, sha256File } from './environment'
import { runTool } from './process'

interface AudioCache { version: 1; file: string; bytes: number; sha256: string; duration: number; title: string; cid?: number }
const invalidAudio = () => new SummarizeError(502, 'ASR_INVALID_AUDIO', 'Downloaded audio does not match the selected video or page')
const invalidTranscript = () => new SummarizeError(502, 'ASR_INVALID_TRANSCRIPT', 'Empty or invalid local transcript; no successful result saved')
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new SummarizeError(499, 'ASR_CANCELLED', 'Local transcription cancelled')
}

/** Dead owners can be recovered on retry; live owners are never overwritten. */
async function withLock<T>(directory: string, work: () => Promise<T>): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = join(directory, '.lock')
  for (let attempt = 0; ; attempt++) {
    try {
      const file = await open(path, 'wx', 0o600)
      await file.writeFile(String(process.pid)); await file.close(); break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const pid = Number(await readFile(path, 'utf8').catch(() => '0'))
      let live = true
      try {
        // A new owner may still be writing its PID. Never steal a fresh lock.
        if (!Number.isInteger(pid) || pid <= 0) live = Date.now() - (await stat(path)).mtimeMs < 60_000
        else process.kill(pid, 0)
      }
      catch (error) { live = (error as NodeJS.ErrnoException).code === 'EPERM' }
      if (live || attempt) throw new SummarizeError(409, 'ASR_BUSY', 'This transcription stage is already running; retry after it finishes')
      await rm(path, { force: true })
    }
  }
  try { return await work() } finally { await rm(path, { force: true }) }
}

function parseSegments(raw: unknown, duration: number): { items: CommonSubtitleItem[]; language?: string } {
  const value = raw as { result?: { language?: string }; transcription?: Array<{ text: string; offsets: { from: number; to: number } }> }
  if (!Array.isArray(value?.transcription)) throw invalidTranscript()
  const items: CommonSubtitleItem[] = []
  let previous = -1
  for (const segment of value.transcription) {
    const start = segment?.offsets?.from / 1000, end = segment?.offsets?.to / 1000
    if (typeof segment?.text !== 'string' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start < previous || end < start || end > duration + 1) throw invalidTranscript()
    previous = start
    const text = segment.text.trim()
    if (text) items.push({ index: items.length, s: start, e: end, text })
  }
  if (!items.length || !items.some(item => /[\p{L}\p{N}]/u.test(item.text))) throw invalidTranscript()
  return { items, language: typeof value.result?.language === 'string' ? value.result.language : undefined }
}

/** Called only after the platform has explicitly reported absent captions. Never installs. */
export async function transcribeLocally(input: SummarizeInput, original: TranscriptResult, subtitles: ResolvedSubtitleConfig, options: LocalTranscriptionOptions): Promise<TranscriptResult> {
  const signal = input.options?.signal ?? options.signal
  cancelled(signal)
  const doctor = await doctorLocalTranscription({ ...options, signal })
  if (!doctor.ready) throw new SummarizeError(400, doctor.model.status === 'invalid' ? 'ASR_MODEL_INVALID' : 'ASR_DEPENDENCIES_MISSING', 'Local transcription is not ready; run asr doctor, review missing items, then choose whether to run asr setup')
  const config = doctor.config, tools = config.tools, video = input.video
  const page = Number(video.pageNumber ?? 1)
  if (!Number.isInteger(page) || page < 1 || !(video.source === 'bilibili' ? /^(BV[a-zA-Z0-9]{10}|av\d+)$/.test(video.videoId) : /^[a-zA-Z0-9_-]{11}$/.test(video.videoId))) throw invalidAudio()
  const progress = options.onProgress
  const stage = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
    cancelled(signal); progress?.({ stage: name, status: 'started' }); const start = Date.now()
    const result = await work(); cancelled(signal)
    progress?.({ stage: name, status: 'complete', seconds: (Date.now() - start) / 1000 }); return result
  }
  const mediaDir = join(config.cacheDir, 'audio', video.source, `${video.videoId}-p${page}`)
  const audio = await withLock(mediaDir, async (): Promise<AudioCache> => {
    const marker = join(mediaDir, 'complete.json')
    try {
      const value = JSON.parse(await readFile(marker, 'utf8')) as AudioCache
      if (value.version !== 1 || !/^audio\.[a-zA-Z0-9]+$/.test(value.file) || !Number.isFinite(value.duration) || value.duration <= 0) throw invalidAudio()
      const path = join(mediaDir, value.file)
      if ((await stat(path)).size !== value.bytes || await sha256File(path) !== value.sha256 || (original.media?.cid && value.cid !== original.media.cid) || (original.media?.durationSeconds && Math.abs(value.duration - original.media.durationSeconds) > Math.max(3, original.media.durationSeconds * 0.01))) throw invalidAudio()
      progress?.({ stage: 'download-audio', status: 'cached' }); return value
    } catch { await rm(marker, { force: true }) }
    for (const entry of await readdir(mediaDir)) if (entry.startsWith('.download-')) await rm(join(mediaDir, entry), { recursive: true, force: true })
    const temp = join(mediaDir, `.download-${randomUUID()}`)
    await mkdir(temp, { mode: 0o700 })
    const cookie = join(temp, 'cookies.txt')
    try {
      return await stage('download-audio', async () => {
        const url = video.source === 'bilibili' ? `https://www.bilibili.com/video/${video.videoId}/?p=${page}` : `https://www.youtube.com/watch?v=${video.videoId}`
        const args = ['--ignore-config', '--no-playlist', '--retries', '1', '--socket-timeout', '30', '-f', 'bestaudio', '--write-info-json', '-o', join(temp, 'audio.%(ext)s')]
        const token = subtitles.bilibiliSessionTokens[0]
        if (video.source === 'bilibili' && token) {
          if (/[\r\n\t]/.test(token)) throw new SummarizeError(400, 'ASR_CONFIG_INVALID', 'Invalid Bilibili session value')
          await writeFile(cookie, `# Netscape HTTP Cookie File\n.bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\t${token}\n`, { mode: 0o600, flag: 'wx' })
          args.push('--cookies', cookie)
        }
        await runTool(tools.ytDlp, [...args, '--', url], 'download-audio', signal, 600_000)
        const info = JSON.parse(await readFile(join(temp, 'audio.info.json'), 'utf8')) as { ext?: string; duration?: number; title?: string; id?: string }
        if (!info.ext || !/^[a-zA-Z0-9]+$/.test(info.ext)) throw invalidAudio()
        // yt-dlp's full info contains signed URLs and headers: never retain it.
        await rm(join(temp, 'audio.info.json'))
        const file = `audio.${info.ext}`, path = join(temp, file)
        const duration = Number((await runTool(tools.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path], 'probe-audio', signal)).trim())
        const expected = original.media?.durationSeconds ?? info.duration
        if (!Number.isFinite(duration) || duration <= 0 || (expected !== undefined && Math.abs(duration - expected) > Math.max(3, expected * 0.01))) throw invalidAudio()
        const value: AudioCache = { version: 1, file, bytes: (await stat(path)).size, sha256: await sha256File(path), duration, title: original.title || info.title || video.videoId, cid: original.media?.cid }
        if (!value.bytes) throw invalidAudio()
        cancelled(signal)
        await rename(path, join(mediaDir, file)); await privateJson(marker, value)
        return value
      })
    } finally { await rm(temp, { recursive: true, force: true }) }
  })
  const asrDir = join(config.cacheDir, 'transcripts', fingerprint({ engine: 'whisper.cpp-v1', audio: audio.sha256, model: doctor.model.sha256, language: config.language }))
  const parsed = await withLock(asrDir, async () => {
    const marker = join(asrDir, 'complete.json')
    try {
      const value = JSON.parse(await readFile(marker, 'utf8')) as { artifacts: Record<string, string> }
      for (const ext of ['json', 'srt', 'txt']) if (await sha256File(join(asrDir, `whisper.${ext}`)) !== value.artifacts[ext]) throw invalidTranscript()
      const result = parseSegments(JSON.parse(await readFile(join(asrDir, 'whisper.json'), 'utf8')), audio.duration)
      progress?.({ stage: 'transcribe', status: 'cached' }); return result
    } catch { await rm(marker, { force: true }) }
    // Clear interrupted private stages, but preserve a validated downloaded audio.
    for (const entry of await readdir(asrDir)) if (entry.startsWith('.stage-')) await rm(join(asrDir, entry), { recursive: true, force: true })
    const temp = join(asrDir, `.stage-${randomUUID()}`)
    await mkdir(temp, { mode: 0o700 })
    try {
      const wav = join(temp, 'audio.wav'), prefix = join(temp, 'whisper')
      await stage('normalize-audio', () => runTool(tools.ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', join(mediaDir, audio.file), '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], 'normalize-audio', signal, 600_000))
      return await stage('transcribe', async () => {
        await runTool(tools.whisperCli, ['-m', config.modelPath, '-f', wav, '-l', config.language, '-oj', '-osrt', '-otxt', '-of', prefix], 'transcribe', signal, 7200_000)
        const result = parseSegments(JSON.parse(await readFile(`${prefix}.json`, 'utf8')), audio.duration)
        const artifacts: Record<string, string> = {}
        for (const ext of ['json', 'srt', 'txt']) {
          if (!(await stat(`${prefix}.${ext}`)).size) throw invalidTranscript()
          artifacts[ext] = await sha256File(`${prefix}.${ext}`)
        }
        cancelled(signal)
        for (const ext of ['json', 'srt', 'txt']) await rename(`${prefix}.${ext}`, join(asrDir, `whisper.${ext}`))
        await privateJson(marker, { version: 1, engine: 'whisper.cpp', model: basename(config.modelPath), modelSha256: doctor.model.sha256, requestedLanguage: config.language, detectedLanguage: result.language, audioDurationSeconds: audio.duration, audioSha256: audio.sha256, artifacts })
        return result
      })
    } finally { await rm(temp, { recursive: true, force: true }) }
  })
  cancelled(signal)
  const items = parsed.items.map(item => ({ ...item, text: input.options?.showTimestamp ? `${item.s} - ${item.text}` : item.text }))
  return { ...original, title: audio.title, subtitlesArray: items, transcriptText: items.map(item => item.text).join(' '), usedDescription: false,
    transcription: { engine: 'whisper.cpp', model: basename(config.modelPath), modelSha256: doctor.model.sha256!, requestedLanguage: config.language, detectedLanguage: parsed.language, audioDurationSeconds: audio.duration, audioSha256: audio.sha256, source: { ...video, ...(video.source === 'bilibili' ? { pageNumber: page } : {}) }, artifacts: { json: join(asrDir, 'whisper.json'), srt: join(asrDir, 'whisper.srt'), text: join(asrDir, 'whisper.txt') } } }
}
