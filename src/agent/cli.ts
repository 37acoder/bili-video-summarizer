import { parseArgs } from 'node:util'
import { readFile, lstat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { defaultAuthFile, startLogin, pollLogin, importSession, readSession, checkSession, request } from './auth'
import { localTranscript, parseVideo, prepareArtifacts } from './prepare'
import { resolveSubtitleConfig } from '../config'
import { fetchTranscriptWithLocal } from '../transcription/fetch'
import { doctorLocalTranscription, setupLocalTranscription } from '../transcription/environment'
import type { LocalTranscriptionOptions, LocalModel } from '../transcription/types'
import { SummarizeError } from '../errors'

const help = `video-summarizer source CLI — Node.js >=22; no LLM API required
  auth login --out <new-private-directory>         Generate login.png and login.json
  auth poll --state <login.json> [--wait]           Check once, or poll for <=180s
  auth import --file <cookie-file|->               Read raw SESSDATA / cookie header / JSON / Netscape
  auth status                                     Verify SESSDATA via Bilibili nav
  prepare --video <URL|BV|av|YouTubeID> --out <new-directory>
  prepare --transcript <txt|json> --out <new-directory> [--title <title>]
  inspect --manifest <manifest.json> [--offset 0] [--limit 20]  Bounded manifest page
  asr doctor                                      Check optional local transcription tools/model
  asr setup                                       Explicitly install missing tools/model only
Options: --auth-file <path>, --chunk-tokens <128..16000; default 3000>,
         --source <bilibili|youtube>, --page <positive integer>,
         --caption-retries <0..3; default 0>  Bounded retries for CAPTIONS_INVALID only
Local ASR: prepare --asr local; --model <small|medium>, --model-path <existing file>,
           --asr-language <auto|Whisper code>, --asr-cache-dir <path>, --asr-config <path>,
           --yt-dlp <path>, --ffmpeg <path>, --ffprobe <path>, --whisper-cli <path>
Auth precedence: BILIBILI_SESSION_TOKEN (one SESSDATA value), then --auth-file,
then ~/.config/video-summarizer/bilibili.json. Import/poll writes the chosen file.
Only manifest path/status is printed. Transcript and chunks are stored on disk.
Existing output directories are rejected. Plain text is assumed to be a transcript;
JSON must have the repository's TranscriptResult shape. Captions are tried first.
ASR is opt-in, runs locally only for explicit caption absence, and never installs.
Setup uses existing Homebrew on macOS; other platforms require manual tools.
Retries stay in the foreground and never reinterpret an error as caption absence.
`

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean' }, wait: { type: 'boolean' },
    out: { type: 'string' }, state: { type: 'string' }, file: { type: 'string' },
    'auth-file': { type: 'string' }, video: { type: 'string' }, transcript: { type: 'string' },
    title: { type: 'string' }, 'chunk-tokens': { type: 'string' }, source: { type: 'string' }, page: { type: 'string' },
    manifest: { type: 'string' }, offset: { type: 'string' }, limit: { type: 'string' },
    'caption-retries': { type: 'string' },
    asr: { type: 'string' }, model: { type: 'string' }, 'model-path': { type: 'string' },
    'asr-language': { type: 'string' }, 'asr-cache-dir': { type: 'string' }, 'asr-config': { type: 'string' },
    'yt-dlp': { type: 'string' }, ffmpeg: { type: 'string' }, ffprobe: { type: 'string' }, 'whisper-cli': { type: 'string' },
  } })
  if (values.help || !positionals.length) { console.log(help); return }
  const authFile = resolve(values['auth-file'] ?? defaultAuthFile())
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort()); process.once('SIGTERM', () => controller.abort())
  const local: LocalTranscriptionOptions = {
    model: values.model as LocalModel | undefined, modelPath: values['model-path'], language: values['asr-language'],
    cacheDir: values['asr-cache-dir'], configFile: values['asr-config'], signal: controller.signal,
    tools: { ytDlp: values['yt-dlp'], ffmpeg: values.ffmpeg, ffprobe: values.ffprobe, whisperCli: values['whisper-cli'] },
    onProgress: event => console.error(JSON.stringify({ progress: event })),
  }
  const required = (name: 'out' | 'state' | 'file') => {
    const value = values[name]
    if (!value) throw new Error(`MISSING_OPTION: --${name}`)
    return value
  }
  let result: unknown
  if (positionals[0] === 'asr') {
    if (positionals[1] === 'doctor') result = await doctorLocalTranscription(local)
    else if (positionals[1] === 'setup') result = await setupLocalTranscription(local)
    else throw new Error('UNKNOWN_ASR_COMMAND')
  } else if (positionals[0] === 'auth') {
    switch (positionals[1]) {
      case 'login': result = await startLogin(resolve(required('out'))); break
      case 'status': result = await checkSession(await readSession(authFile)); break
      case 'import': {
        const file = required('file')
        const input = file === '-' ? await new Promise<string>((done, reject) => {
          let text = ''; process.stdin.setEncoding('utf8')
          process.stdin.on('data', chunk => { text += chunk }); process.stdin.on('end', () => done(text)); process.stdin.on('error', reject)
        }) : await readFile(file, 'utf8')
        result = await importSession(input, authFile); break
      }
      case 'poll': {
        const deadline = Date.now() + 180_000
        do {
          result = await pollLogin(resolve(required('state')), authFile)
          if (!values.wait || (result as { state: string }).state === 'authenticated') break
          await new Promise(done => setTimeout(done, 3000))
        } while (Date.now() < deadline)
        if (values.wait && (result as { state: string }).state !== 'authenticated') throw new Error('QR_TIMEOUT')
        break
      }
      default: throw new Error('UNKNOWN_AUTH_COMMAND')
    }
  } else if (positionals[0] === 'inspect') {
    if (!values.manifest) throw new Error('MISSING_OPTION: --manifest')
    const offset = Number(values.offset ?? 0), limit = Number(values.limit ?? 20)
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('INVALID_MANIFEST_PAGE')
    const manifest = JSON.parse(await readFile(values.manifest, 'utf8'))
    if (manifest.version !== 1 || !Array.isArray(manifest.chunks)) throw new Error('INVALID_MANIFEST')
    const { chunks, ...metadata } = manifest
    result = { ...metadata, offset, chunks: chunks.slice(offset, offset + limit),
      nextOffset: offset + limit < chunks.length ? offset + limit : null }
  } else if (positionals[0] === 'prepare') {
    if (!!values.video === !!values.transcript) throw new Error('PROVIDE_ONE_OF_VIDEO_OR_TRANSCRIPT')
    const out = required('out')
    try { await lstat(out); throw new Error('OUTPUT_EXISTS: choose a new output directory') }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    if (values.asr && values.asr !== 'local') throw new Error('INVALID_ASR: use local')
    const captionRetries = Number(values['caption-retries'] ?? 0)
    if (!Number.isInteger(captionRetries) || captionRetries < 0 || captionRetries > 3) throw new Error('INVALID_CAPTION_RETRIES: use 0..3')
    let transcript
    let provenance: unknown
    if (values.transcript) {
      transcript = await localTranscript(values.transcript, values.title)
      provenance = { kind: 'provided-transcript', file: resolve(values.transcript) }
    } else {
      const video = parseVideo(values.video!, values.source)
      if (values.page) {
        const page = Number(values.page)
        if (video.source !== 'bilibili' || !Number.isInteger(page) || page < 1) throw new Error('INVALID_PAGE')
        video.pageNumber = page
      }
      const token = video.source === 'bilibili' ? await readSession(authFile) : undefined
      if (token) await checkSession(token, (url, init) => request(String(url), { ...init, signal: controller.signal }))
      const config = resolveSubtitleConfig({ bilibiliSessionTokens: token ? [token] : [] })
      // No LLM imports, credentials or requests on the preparation path.
      for (let attempt = 0; ; attempt++) {
        controller.signal.throwIfAborted()
        try {
          transcript = await fetchTranscriptWithLocal({ video, options: { showTimestamp: true, signal: controller.signal } }, config, {
            config, fetch: (url, init) => request(String(url), init),
            logger: { debug() {}, info() {}, warn() {}, error() {} },
          }, values.asr === 'local' ? local : undefined)
          if (transcript.captionStatus === 'unusable') throw new SummarizeError(502, 'CAPTIONS_INVALID', 'Platform captions are invalid; retry or provide a transcript')
          break
        } catch (error) {
          if (controller.signal.aborted || !(error instanceof SummarizeError) || error.code !== 'CAPTIONS_INVALID' || attempt >= captionRetries) throw error
          console.error(JSON.stringify({ progress: { stage: 'caption-retry', attempt: attempt + 1, maxRetries: captionRetries, reason: 'CAPTIONS_INVALID' } }))
          await delay(1000, undefined, { signal: controller.signal })
        }
      }
      if (transcript.captionStatus === 'absent' && !transcript.transcription) {
        const error = new SummarizeError(501, 'NO_TRANSCRIPT', 'No available platform captions')
        Object.assign(error, { reason: 'captions_absent' }); throw error
      }
      provenance = transcript.transcription ? { kind: 'local-asr', ...transcript.transcription } : { kind: 'platform-captions', ...video }
    }
    result = await prepareArtifacts(transcript, out, Number(values['chunk-tokens'] ?? 3000), provenance)
  } else throw new Error('UNKNOWN_COMMAND')
  console.log(JSON.stringify(result))
}

main().catch(error => {
  // Platform responses / cookie values are never dumped, including nested causes.
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  console.error(JSON.stringify({ error: error instanceof SummarizeError ? error.code : error instanceof SyntaxError ? 'INVALID_JSON' : message,
    ...(error instanceof SummarizeError ? { message, reason: (error as { reason?: string }).reason } : {}) }))
  process.exitCode = 1
})
