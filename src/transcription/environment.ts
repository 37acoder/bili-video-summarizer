import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { SummarizeError } from '../errors'
import { privateJson } from '../agent/auth'
import type { AsrTool, LocalModel, LocalTranscriptionOptions, ResolvedLocalOptions } from './types'
import { runTool } from './process'

// LFS SHA-256 and sizes from the upstream model repository, checked 2026-10-10.
export const LOCAL_MODELS = {
  small: { bytes: 487601967, sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b' },
  medium: { bytes: 1533763059, sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208' },
} as const
const commands: Record<AsrTool, string> = { ytDlp: 'yt-dlp', ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', whisperCli: 'whisper-cli' }
const packageFor = (tool: AsrTool) => tool === 'ytDlp' ? 'yt-dlp' : tool === 'whisperCli' ? 'whisper.cpp' : 'ffmpeg'
export async function sha256File(path: string) {
  const hash = createHash('sha256')
  for await (const data of createReadStream(path)) hash.update(data)
  return hash.digest('hex')
}
export function fingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }

export async function resolveLocalOptions(options: LocalTranscriptionOptions = {}): Promise<ResolvedLocalOptions> {
  const configFile = resolve(options.configFile ?? join(homedir(), '.config/video-summarizer/asr.json'))
  let stored: LocalTranscriptionOptions = {}
  try {
    stored = JSON.parse(await readFile(configFile, 'utf8'))
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new SummarizeError(400, 'ASR_CONFIG_INVALID', 'Invalid local transcription configuration')
  }
  const model = options.model ?? stored.model ?? 'small'
  if (!Object.hasOwn(LOCAL_MODELS, model)) throw new SummarizeError(400, 'ASR_CONFIG_INVALID', 'Use small or medium, or provide --model-path')
  const cacheDir = resolve(options.cacheDir ?? stored.cacheDir ?? join(homedir(), '.cache/video-summarizer'))
  const language = options.language ?? stored.language ?? 'auto'
  if (!/^[a-z]{2,3}$/.test(language) && language !== 'auto') throw new SummarizeError(400, 'ASR_CONFIG_INVALID', 'Use a Whisper language code or auto')
  // Explicit model selection does not inherit a previously configured different model path.
  const modelPath = resolve(options.modelPath ?? (options.model ? undefined : stored.modelPath) ?? join(cacheDir, 'models', `ggml-${model}.bin`))
  const tools = Object.fromEntries(Object.entries(commands).map(([key, command]) => [key, options.tools?.[key as AsrTool] ?? stored.tools?.[key as AsrTool] ?? command])) as Record<AsrTool, string>
  if (Object.values(tools).some(value => typeof value !== 'string' || !value.trim())) throw new SummarizeError(400, 'ASR_CONFIG_INVALID', 'Invalid tool path')
  return { model, modelPath, language, cacheDir, configFile, tools }
}

async function checkModel(path: string) {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size < 1024 * 1024) return { status: 'invalid' as const }
    const file = await open(path, 'r')
    const header = Buffer.alloc(8)
    try { await file.read(header, 0, 8, 0) } finally { await file.close() }
    if (header.readUInt32LE(0) !== 0x67676d6c || header.readUInt32LE(4) < 51865) return { status: 'invalid' as const }
    const hash = await sha256File(path)
    const known = Object.entries(LOCAL_MODELS).find(([name]) => basename(path) === `ggml-${name}.bin`)?.[1]
    if (known && (info.size !== known.bytes || hash !== known.sha256)) return { status: 'invalid' as const }
    return { status: 'ready' as const, bytes: info.size, sha256: hash }
  } catch (error) { return { status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' as const : 'invalid' as const } }
}

export async function doctorLocalTranscription(options: LocalTranscriptionOptions = {}) {
  const config = await resolveLocalOptions(options)
  const toolResults = await Promise.all(Object.entries(config.tools).map(async ([name, command]) => {
    let available = true
    try { await runTool(command, [name === 'ffmpeg' || name === 'ffprobe' ? '-version' : '--version'], 'doctor', options.signal, 15_000) }
    catch (error) { if (options.signal?.aborted) throw error; available = false }
    return { name: name as AsrTool, command, available }
  }))
  const model = { ...await checkModel(config.modelPath), path: config.modelPath, name: config.model }
  const missingTools = toolResults.filter(tool => !tool.available).map(tool => tool.name)
  let homebrewPrefix: string | undefined
  if (missingTools.length && process.platform === 'darwin') {
    try { homebrewPrefix = (await runTool('brew', ['--prefix'], 'doctor', options.signal, 15_000)).trim() || undefined }
    catch (error) { if (options.signal?.aborted) throw error }
  }
  return { ready: missingTools.length === 0 && model.status === 'ready', platform: process.platform,
    config, tools: toolResults, missingTools, model, downloadBytes: LOCAL_MODELS[config.model].bytes,
    installation: { toolPackages: [...new Set(missingTools.map(packageFor))], homebrewPrefix,
      modelDownloadBytes: model.status === 'missing' ? LOCAL_MODELS[config.model].bytes : 0,
      modelUrl: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${config.model}.bin` },
    setupSupported: process.platform === 'darwin', nextCommand: 'asr setup' }
}

/** Explicit setup only: never called by prepare or the library fallback. */
export async function setupLocalTranscription(options: LocalTranscriptionOptions = {}) {
  const before = await doctorLocalTranscription(options)
  const config = before.config
  if (before.model.status === 'invalid') throw new SummarizeError(400, 'ASR_MODEL_INVALID', 'Model is invalid; choose a valid model path or remove the damaged file before setup')
  if (before.missingTools.length) {
    if (process.platform !== 'darwin') throw new SummarizeError(400, 'ASR_SETUP_UNSUPPORTED', 'Install tools manually on this platform, then run asr doctor')
    try { await runTool('brew', ['--version'], 'Homebrew', options.signal) }
    catch (error) { if (options.signal?.aborted) throw error; throw new SummarizeError(400, 'ASR_SETUP_UNSUPPORTED', 'Homebrew is missing; prepare it manually or configure existing tool paths') }
    // Do not overwrite a deliberately configured inaccessible binary path.
    if (before.missingTools.some(tool => config.tools[tool] !== commands[tool])) throw new SummarizeError(400, 'ASR_CONFIG_INVALID', 'Configured tool is unavailable; fix its path before installing')
    const packages = before.installation.toolPackages
    options.onProgress?.({ stage: 'install-tools', status: 'started' })
    await runTool('brew', ['install', ...packages], 'install-tools', options.signal, 1800_000)
    options.onProgress?.({ stage: 'install-tools', status: 'complete' })
  }
  if (before.model.status === 'missing') {
    if (options.modelPath || config.modelPath !== join(config.cacheDir, 'models', `ggml-${config.model}.bin`)) throw new SummarizeError(400, 'ASR_MODEL_INVALID', 'Specified model file is missing; provide an existing model or omit --model-path to download')
    await mkdir(dirname(config.modelPath), { recursive: true, mode: 0o700 })
    const temp = `${config.modelPath}.${randomUUID()}.part`
    options.onProgress?.({ stage: 'download-model', status: 'started' })
    try {
      const response = await fetch(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${config.model}.bin`, { signal: options.signal ?? AbortSignal.timeout(1800_000) })
      if (!response.ok || !response.body) throw new SummarizeError(502, 'ASR_MODEL_DOWNLOAD_FAILED', `Model download HTTP ${response.status}`)
      await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream), createWriteStream(temp, { flags: 'wx', mode: 0o600 }), { signal: options.signal })
      const expected = LOCAL_MODELS[config.model]
      if ((await stat(temp)).size !== expected.bytes || await sha256File(temp) !== expected.sha256) throw new SummarizeError(502, 'ASR_MODEL_INVALID', 'Downloaded model checksum failed')
      await rename(temp, config.modelPath)
    } catch (error) {
      if (error instanceof SummarizeError) throw error
      throw new SummarizeError(options.signal?.aborted ? 499 : 502, options.signal?.aborted ? 'ASR_CANCELLED' : 'ASR_MODEL_DOWNLOAD_FAILED', 'Model download interrupted; rerun setup')
    } finally { await rm(temp, { force: true }) }
    options.onProgress?.({ stage: 'download-model', status: 'complete' })
  }
  const after = await doctorLocalTranscription({ ...options, ...config })
  if (!after.ready) throw new SummarizeError(500, 'ASR_DEPENDENCIES_MISSING', 'Setup incomplete; run asr doctor for missing items')
  await privateJson(config.configFile, config)
  return after
}
