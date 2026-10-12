import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify, parseArgs } from 'node:util'
import { gzipSync, gunzipSync } from 'node:zlib'
import { setTimeout as delay } from 'node:timers/promises'
import WebSocket from 'ws'

export const ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async'
export const RESOURCE = 'volc.seedasr.sauc.duration'
const VERSION = 'doubao-rich-v1'
const CONFIG = join(homedir(), '.config/video-summarizer/doubao.json')
const CACHE = join(homedir(), '.cache/video-summarizer/doubao')
export const PARAMETERS = { model_name: 'bigmodel', enable_nonstream: true, enable_itn: true,
  enable_punc: true, enable_ddc: false, show_utterances: true, enable_speaker_info: true,
  enable_emotion_detection: true, enable_gender_detection: true, show_speech_rate: true,
  show_volume: true, enable_lid: true, result_type: 'full' }
const VIEW_FIELDS = ['speaker_id', 'emotion', 'emotion_degree', 'emotion_score', 'emotion_degree_score',
  'gender', 'gender_score', 'speech_rate', 'volume', 'lid_lang', 'lid_lang_score', 'source', 'invoke_type']
export class Failure extends Error {}
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const exists = async path => { try { await access(path); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error } }
const expand = path => resolve(path === '~' ? homedir() : path.startsWith('~/') ? join(homedir(), path.slice(2)) : path)
export async function privateJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = path + '.' + randomUUID() + '.tmp'
  try { await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); await rename(temporary, path) }
  finally { await rm(temporary, { force: true }) }
}
export async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
async function readKey(path) {
  let key = process.env.DOUBAO_ASR_API_KEY
  if (!key) {
    try { const value = await json(expand(path)); key = value.api_key; if (key === value.name) throw new Failure('DOUBAO_KEY_INVALID') }
    catch (error) { if (error instanceof Failure) throw error; throw new Failure(error.code === 'ENOENT' ? 'DOUBAO_KEY_MISSING' : 'DOUBAO_CONFIG_INVALID') }
  }
  if (typeof key !== 'string' || !key.trim() || /[\s*]/.test(key)) throw new Failure('DOUBAO_KEY_INVALID')
  return key
}
async function tool(command, timeout = 600_000, signal) {
  try { return (await promisify(execFile)(command[0], command.slice(1), { timeout, signal, maxBuffer: 16 * 1024 * 1024 })).stdout }
  catch (error) {
    if (signal?.aborted) throw new Failure('DOUBAO_CANCELLED')
    throw new Failure(error.code === 'ENOENT' ? 'DOUBAO_MEDIA_TOOL_MISSING' : error.killed ? 'DOUBAO_MEDIA_TOOL_TIMEOUT' : 'DOUBAO_MEDIA_TOOL_FAILED')
  }
}
async function audioInfo(path) {
  const handle = await open(path, 'r')
  try {
    const header = Buffer.alloc(12); await handle.read(header, 0, 12, 0)
    if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE') return null
    const size = (await handle.stat()).size
    let position = 12, valid = false, dataBytes
    while (position + 8 <= size) {
      const chunk = Buffer.alloc(8); await handle.read(chunk, 0, 8, position)
      const length = chunk.readUInt32LE(4), name = chunk.toString('ascii', 0, 4)
      if (position + 8 + length > size) return null
      if (name === 'fmt ' && length >= 16) {
        const format = Buffer.alloc(16); await handle.read(format, 0, 16, position + 8)
        valid = format.readUInt16LE(0) === 1 && format.readUInt16LE(2) === 1 && format.readUInt32LE(4) === 16000 && format.readUInt16LE(14) === 16
      }
      if (name === 'data') dataBytes = length
      position += 8 + length + (length % 2)
    }
    if (!valid || dataBytes === undefined || dataBytes % 2) return null
    if (dataBytes <= 0) throw new Failure('DOUBAO_INVALID_AUDIO')
    return dataBytes / 32000
  } finally { await handle.close() }
}
export async function downloadAudio(args, dependencies = {}) {
  const fetcher = dependencies.fetch ?? fetch, media = dependencies.tool ?? tool
  let url, source, videoId, page = 1
  try {
    const input = new URL(args.video)
    if (['www.bilibili.com', 'bilibili.com'].includes(input.hostname)) {
      const match = /^\/video\/(BV[a-zA-Z0-9]{10}|av\d+)\/?$/.exec(input.pathname)
      if (!match) throw Error()
      videoId = match[1]; page = Number(input.searchParams.get('p') ?? 1); source = 'bilibili'
      if (!Number.isInteger(page) || page < 1) throw Error()
      url = `https://www.bilibili.com/video/${videoId}/?p=${page}`
    } else if (['www.youtube.com', 'youtube.com', 'youtu.be'].includes(input.hostname)) {
      videoId = input.hostname === 'youtu.be' ? input.pathname.slice(1) : input.searchParams.get('v')
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId ?? '')) throw Error()
      source = 'youtube'; url = `https://www.youtube.com/watch?v=${videoId}`
    } else throw Error()
  } catch { throw new Failure('DOUBAO_VIDEO_URL_INVALID') }
  const out = resolve(args.out)
  if (await exists(out) || !(await stat(dirname(out))).isDirectory()) throw new Failure('DOUBAO_OUTPUT_EXISTS_OR_PARENT_MISSING')
  const stage = await mkdtemp(join(dirname(out), '.doubao-download-'))
  try {
    let expected, originalTitle, cid
    const command = [args.ytDlp ?? 'yt-dlp', '--ignore-config', '--no-playlist', '--retries', '1', '--socket-timeout', '30', '-f', 'bestaudio', '--write-info-json', '-o', join(stage, 'audio.%(ext)s')]
    if (source === 'bilibili') {
      let token = process.env.BILIBILI_SESSION_TOKEN
      if (!token) { try { token = (await json(expand(args.authFile ?? join(homedir(), '.config/video-summarizer/bilibili.json')))).SESSDATA } catch { throw new Failure('DOUBAO_BILIBILI_AUTH_REQUIRED') } }
      if (typeof token !== 'string' || !token || /[\s;]/.test(token)) throw new Failure('DOUBAO_BILIBILI_AUTH_INVALID')
      const api = async path => {
        const reply = await fetcher('https://api.bilibili.com' + path, { headers: { Cookie: 'SESSDATA=' + token, 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com/' }, signal: args.signal ? AbortSignal.any([args.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) })
        if (!reply.ok) throw new Failure('DOUBAO_BILIBILI_API_FAILED')
        const value = await reply.json(); if (value.code !== 0) throw new Failure('DOUBAO_BILIBILI_API_FAILED')
        return value.data
      }
      if (!(await api('/x/web-interface/nav')).isLogin) throw new Failure('DOUBAO_BILIBILI_AUTH_INVALID')
      const view = await api('/x/web-interface/view?' + new URLSearchParams(videoId.startsWith('BV') ? { bvid: videoId } : { aid: videoId.slice(2) }))
      const selected = view.pages?.find(p => p.page === page)
      if (!selected) throw new Failure('DOUBAO_PAGE_NOT_FOUND')
      expected = selected.duration; originalTitle = view.title; cid = selected.cid
      const cookie = join(stage, 'cookies.txt')
      await writeFile(cookie, '# Netscape HTTP Cookie File\n.bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\t' + token + '\n', { mode: 0o600 })
      command.push('--cookies', cookie)
    }
    await media([...command, '--', url], 600_000, args.signal)
    const info = await json(join(stage, 'audio.info.json')), extension = info.ext ?? ''
    if (!/^[a-zA-Z0-9]+$/.test(extension)) throw new Failure('DOUBAO_INVALID_AUDIO')
    if (source === 'youtube' && info.id !== videoId) throw new Failure('DOUBAO_VIDEO_ID_MISMATCH')
    if (source === 'bilibili') {
      const identity = String(info.id ?? '')
      if (![videoId, String(cid), `${videoId}_${cid}`].includes(identity)) throw new Failure('DOUBAO_VIDEO_ID_MISMATCH')
      const reportedPage = info.webpage_url ? new URL(info.webpage_url).searchParams.get('p') : null
      if (page > 1 && ![String(cid), `${videoId}_${cid}`].includes(identity) && reportedPage !== String(page)) throw new Failure('DOUBAO_PAGE_UNVERIFIED')
    }
    const audio = join(stage, 'audio.' + extension)
    const seconds = Number((await media([args.ffprobe ?? 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audio], 600_000, args.signal)).trim())
    expected ??= info.duration
    if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(expected) || Math.abs(seconds - expected) > Math.max(3, expected * .01)) throw new Failure('DOUBAO_DURATION_MISMATCH')
    const metadata = { source, videoId, pageNumber: page, cid: cid ?? null, title: originalTitle || info.title || videoId, durationSeconds: seconds, audioSha256: await sha256(audio), url }
    await mkdir(out, { mode: 0o700 }); await rename(audio, join(out, 'audio.' + extension))
    await privateJson(join(out, 'audio-source.json'), metadata)
    return { audio: join(out, 'audio.' + extension), metadata: join(out, 'audio-source.json'), ...metadata }
  } finally { await rm(stage, { recursive: true, force: true }) }
}
export function packet(payload, sequence, audio = false, last = false) {
  const compressed = gzipSync(payload), header = Buffer.alloc(12)
  header.set([0x11, ((audio ? 2 : 1) << 4) | (last ? 3 : 1), 0x11, 0])
  header.writeInt32BE(last ? -sequence : sequence, 4); header.writeUInt32BE(compressed.length, 8)
  return Buffer.concat([header, compressed])
}
export function parsePacket(data) {
  try {
    if (data.length < 8 || data[0] >> 4 !== 1) throw Error()
    const kind = data[1] >> 4, flags = data[1] & 15
    let cursor = (data[0] & 15) * 4, code = 0
    if (![9, 15].includes(kind) || cursor < 4) throw Error()
    if (flags & 1) cursor += 4
    if (flags & 4) cursor += 4
    if (kind === 15) { code = data.readUInt32BE(cursor); cursor += 4 }
    const length = data.readUInt32BE(cursor); let body = data.subarray(cursor + 4)
    if (body.length !== length || data[2] >> 4 !== 1) throw Error()
    if ((data[2] & 15) === 1) body = gunzipSync(body, { maxOutputLength: 64 * 1024 * 1024 })
    else if ((data[2] & 15) !== 0) throw Error()
    return { code, is_last_package: Boolean(flags & 2), payload_msg: JSON.parse(body.toString('utf8')) }
  } catch { throw new Failure('DOUBAO_PROTOCOL_INVALID') }
}
export function validate(response, seconds) {
  if (response?.code !== 0 || response?.is_last_package !== true) throw new Failure('DOUBAO_RESULT_NOT_FINAL')
  const body = response.payload_msg, duration = body?.audio_info?.duration
  if (!Number.isFinite(duration) || Math.abs(duration / 1000 - seconds) > Math.max(1, seconds * .01)) throw new Failure('DOUBAO_DURATION_MISMATCH')
  const result = body?.result, utterances = result?.utterances
  if (typeof result?.text !== 'string' || !result.text.trim() || !Array.isArray(utterances) || !utterances.length) throw new Failure('DOUBAO_TRANSCRIPT_EMPTY')
  let previous = -1
  for (const item of utterances) {
    const start = item?.start_time, end = item?.end_time
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < previous || start < 0 || end < start || end > seconds * 1000 + 1000 || item.definite !== true) throw new Failure('DOUBAO_TIMESTAMPS_INVALID')
    if (typeof item.text !== 'string' || (item.additions !== undefined && (!item.additions || typeof item.additions !== 'object' || Array.isArray(item.additions)))) throw new Failure('DOUBAO_RESULT_INVALID')
    previous = start
  }
  return body
}
async function recognize(audio, key, request, requestId, statePath, seconds, args, endpoint) {
  if (args.signal?.aborted) throw new Failure('DOUBAO_CANCELLED')
  const state = { status: 'connecting', request_id: requestId, audio_packets_sent: 0 }
  await privateJson(statePath, state)
  const socket = new WebSocket(endpoint, { headers: { 'X-Api-Key': key, 'X-Api-Resource-Id': RESOURCE, 'X-Api-Request-Id': requestId }, handshakeTimeout: 30_000, maxPayload: 64 * 1024 * 1024, perMessageDeflate: false })
  let acknowledged = false, settled = false, timer, ackTimer, sender
  const stop = new AbortController()
  try {
    return await new Promise((done, reject) => {
      const fail = error => { if (!settled) { settled = true; reject(error) } }
      const abort = () => fail(new Failure('DOUBAO_CANCELLED'))
      args.signal?.addEventListener('abort', abort, { once: true })
      stop.signal.addEventListener('abort', () => args.signal?.removeEventListener('abort', abort), { once: true })
      if (args.signal?.aborted) abort()
      timer = setTimeout(() => fail(new Failure('DOUBAO_TIMEOUT')), (seconds + (args.tailTimeout ?? 120)) * 1000)
      socket.on('error', () => fail(new Failure('DOUBAO_CONNECTION_INTERRUPTED')))
      socket.on('unexpected-response', (_request, reply) => {
        state.status = 'rejected_before_audio'; state.http_status = reply.statusCode
        reply.resume(); fail(new Failure([401, 403].includes(reply.statusCode) ? 'DOUBAO_AUTH_OR_SERVICE_DENIED' : 'DOUBAO_HANDSHAKE_FAILED'))
      })
      socket.on('close', () => fail(new Failure('DOUBAO_TERMINAL_RESPONSE_MISSING')))
      socket.on('open', () => {
        ackTimer = setTimeout(() => fail(new Failure('DOUBAO_REQUEST_TIMEOUT')), 30_000)
        socket.send(packet(Buffer.from(JSON.stringify(request)), 1), error => { if (error) fail(new Failure('DOUBAO_REQUEST_REJECTED')) })
      })
      socket.on('message', (data, binary) => {
        if (settled) return
        try {
          if (!binary) throw new Failure('DOUBAO_CONNECTION_INTERRUPTED')
          const row = parsePacket(Buffer.from(data))
          if (row.code) throw new Failure(acknowledged ? 'DOUBAO_RECOGNITION_FAILED' : 'DOUBAO_REQUEST_REJECTED')
          if (!acknowledged) {
            acknowledged = true; clearTimeout(ackTimer); state.status = 'streaming'
            sender = (async () => {
              await privateJson(statePath, state)
              const handle = await open(audio, 'r')
              try {
                const size = (await handle.stat()).size; let position = 0, sequence = 2, deadline = performance.now()
                while (position < size && !stop.signal.aborted) {
                  const bytes = Buffer.alloc(Math.min(6400, size - position))
                  await handle.read(bytes, 0, bytes.length, position); position += bytes.length
                  await new Promise((sent, failed) => socket.send(packet(bytes, sequence++, true, position === size), error => error ? failed(error) : sent()))
                  state.audio_packets_sent++
                  deadline += 200; await delay(Math.max(0, deadline - performance.now()), undefined, { signal: stop.signal })
                }
              } finally { await handle.close() }
            })()
            sender.catch(error => { if (!stop.signal.aborted) fail(error instanceof Failure ? error : new Failure('DOUBAO_CONNECTION_INTERRUPTED')) })
          } else if (row.is_last_package) {
            validate(row, seconds); settled = true; done(row)
          }
        } catch (error) { fail(error) }
      })
    })
  } finally {
    clearTimeout(timer); clearTimeout(ackTimer); stop.abort(); socket.terminate()
    if (sender) await sender.catch(() => {})
    await privateJson(statePath, state)
  }
}
async function exportJob(args, response, seconds, audioHash, request, requestId, cached) {
  const body = validate(response, seconds), original = body.result.utterances
  const items = original.flatMap((u, i) => u.text.trim() ? [{ text: u.text, s: u.start_time / 1000, e: u.end_time / 1000, asrUtteranceIndex: i }] : []).map((u, index) => ({ index, ...u }))
  if (!items.length) throw new Failure('DOUBAO_TRANSCRIPT_EMPTY')
  const provenance = { kind: 'cloud-asr', provider: 'doubao', resourceId: RESOURCE, requestId, audioSha256: audioHash, audioDurationSeconds: seconds, cached,
    source: { source: args.source, videoId: args.videoId, pageNumber: args.page }, adapterVersion: VERSION, imported: request === null, logId: body.result.additions?.log_id ?? null }
  const transcript = { title: args.title, source: args.source, videoId: args.videoId, usedDescription: false, subtitlesArray: items, transcriptText: body.result.text }
  const temporary = await mkdtemp(join(dirname(args.out), '.doubao-prepare-'))
  try {
    const input = join(temporary, 'transcript.json'); await privateJson(input, transcript)
    await tool([process.execPath, args.sourceCli, 'prepare', '--transcript', input, '--out', args.out, '--chunk-tokens', String(args.chunkTokens)], 60_000, args.signal)
  } finally { await rm(temporary, { recursive: true, force: true }) }
  await privateJson(join(args.out, 'transcript.json'), { ...await json(join(args.out, 'transcript.json')), cloudTranscription: provenance })
  await privateJson(join(args.out, 'asr/doubao-response.json'), response)
  await privateJson(join(args.out, 'asr/doubao-request.json'), { endpoint: ENDPOINT, resourceId: RESOURCE, requestId, payload: request })
  const manifestPath = join(args.out, 'manifest.json'), manifest = await json(manifestPath)
  manifest.provenance = provenance
  let cursor = 0, consumed = 0
  for (const chunk of manifest.chunks) {
    const chunkBody = await json(join(args.out, chunk.file)), groups = []
    for (const piece of chunkBody.items) {
      const source = items[cursor], text = piece.text
      if (!source || source.text.slice(consumed, consumed + text.length) !== text || piece.s !== source.s) throw new Failure('DOUBAO_CHUNK_ALIGNMENT_FAILED')
      const uindex = source.asrUtteranceIndex, last = groups.at(-1)
      if (last?.utteranceIndex === uindex) last.lastItemIndex = piece.index
      else groups.push({ utteranceIndex: uindex, firstItemIndex: piece.index, lastItemIndex: piece.index, s: source.s, e: source.e,
        additions: Object.fromEntries(Object.entries(original[uindex].additions ?? {}).filter(([key]) => VIEW_FIELDS.includes(key))) })
      consumed += text.length
      if (consumed === source.text.length) { cursor++; consumed = 0 }
    }
    const richFile = `asr/chunks/${chunk.id}.json`
    await privateJson(join(args.out, richFile), { chunkId: chunk.id, utterances: groups }); chunk.asrMetadataFile = richFile
  }
  if (cursor !== items.length || consumed) throw new Failure('DOUBAO_CHUNK_ALIGNMENT_FAILED')
  await privateJson(manifestPath, manifest)
  await privateJson(join(args.out, 'asr/complete.json'), { ...provenance, status: 'complete', utteranceCount: original.length, wordCount: original.reduce((sum, u) => sum + (u.words?.length ?? 0), 0) })
  return { manifest: manifestPath, chunkCount: manifest.chunkCount, provider: 'doubao', cached, usedDescription: false }
}
// Match Python json.dumps(sort_keys=True) so existing paid-session caches remain usable.
function cacheJson(value) {
  if (Array.isArray(value)) return '[' + value.map(cacheJson).join(', ') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ': ' + cacheJson(value[key])).join(', ') + '}'
  return JSON.stringify(value)
}
export async function prepare(options, dependencies = {}) {
  const args = { page: 1, language: 'auto', chunkTokens: 3000, credentialFile: CONFIG, cacheDir: CACHE, tailTimeout: 120, ffmpeg: 'ffmpeg', ...options }
  args.out = resolve(args.out); args.audio = resolve(args.audio); args.sourceCli = resolve(args.sourceCli)
  if (await exists(args.out) || !(await stat(dirname(args.out))).isDirectory()) throw new Failure('DOUBAO_OUTPUT_EXISTS_OR_PARENT_MISSING')
  if (!['bilibili', 'youtube'].includes(args.source) || !args.title || !args.videoId || !Number.isInteger(args.page) || args.page < 1 || !Number.isInteger(args.tailTimeout) || args.tailTimeout < 1 || !['auto', 'zh-CN'].includes(args.language) || !Number.isInteger(args.chunkTokens) || args.chunkTokens < 128 || args.chunkTokens > 16000 || !(await exists(args.audio)) || !(await exists(args.sourceCli))) throw new Failure('DOUBAO_INPUT_INVALID')
  const cacheRoot = expand(args.cacheDir); await mkdir(cacheRoot, { recursive: true, mode: 0o700 })
  const temporary = await mkdtemp(join(cacheRoot, '.normalize-'))
  try {
    let audio = args.audio, seconds = await audioInfo(audio)
    if (seconds === null) {
      audio = join(temporary, 'audio.wav')
      await tool([args.ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', '-i', args.audio, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', audio], 600_000, args.signal)
      seconds = await audioInfo(audio)
    }
    if (seconds === null || seconds > 5 * 3600) throw new Failure('DOUBAO_INVALID_AUDIO')
    const audioHash = await sha256(audio), request = { user: { uid: 'video-summarizer' }, audio: { format: 'wav', codec: 'raw', rate: 16000, bits: 16, channel: 1, ...(args.language === 'zh-CN' ? { language: 'zh-CN' } : {}) }, request: { ...PARAMETERS } }
    const cacheId = createHash('sha256').update(cacheJson([VERSION, RESOURCE, audioHash, request])).digest('hex')
    const cache = join(cacheRoot, cacheId); await mkdir(cache, { recursive: true, mode: 0o700 })
    const lock = join(cache, '.lock')
    try { const handle = await open(lock, 'wx', 0o600); try { await handle.writeFile(String(process.pid)) } finally { await handle.close() } }
    catch (error) { if (error.code === 'EEXIST') throw new Failure('DOUBAO_BUSY: verify owner before removing a stale lock'); throw error }
    try {
      let response, requestId, cached = false
      const marker = join(cache, 'complete.json')
      if (await exists(marker) && !args.importResponse) {
        try {
          const value = await json(marker)
          if (await sha256(join(cache, 'response.json')) !== value.responseSha256) throw Error()
          response = await json(join(cache, 'response.json')); validate(response, seconds); requestId = value.requestId; cached = true
        } catch { throw new Failure('DOUBAO_CACHE_INVALID') }
      }
      if (!cached) {
        if (args.importResponse) { response = await json(args.importResponse); validate(response, seconds); return await exportJob(args, response, seconds, audioHash, null, null, false) }
        const key = await readKey(args.credentialFile), attempt = join(cache, 'attempt.json')
        if (await exists(attempt) && !args.retry) throw new Failure('DOUBAO_PREVIOUS_ATTEMPT: inspect attempt.json; explicit --retry may repeat billing')
        requestId = randomUUID(); const started = performance.now()
        args.onProgress?.({ progress: 'doubao-transcribe', audioSeconds: seconds, requestId })
        try { response = await recognize(audio, key, request, requestId, attempt, seconds, args, dependencies.endpoint ?? ENDPOINT) }
        catch (error) {
          if (await exists(attempt)) { const state = await json(attempt); if (state.status !== 'rejected_before_audio') state.status = 'incomplete_outcome_unknown'; await privateJson(attempt, state) }
          throw error
        }
        args.onProgress?.({ progress: 'doubao-complete', seconds: Math.round(performance.now() - started) / 1000 })
        await privateJson(join(cache, 'response.json'), response)
        await privateJson(marker, { requestId, responseSha256: await sha256(join(cache, 'response.json')) })
      }
      return await exportJob(args, response, seconds, audioHash, request, requestId, cached)
    } finally { await rm(lock, { force: true }) }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
export async function main(argv, scriptDirectory) {
  const names = ['audio', 'title', 'source', 'video-id', 'page', 'out', 'source-cli', 'credential-file', 'cache-dir', 'language', 'chunk-tokens', 'tail-timeout', 'ffmpeg', 'video', 'auth-file', 'yt-dlp', 'ffprobe', 'job', 'chunk', 'offset', 'limit', 'import-response']
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { ...Object.fromEntries(names.map(name => [name, { type: 'string' }])), retry: { type: 'boolean' }, help: { type: 'boolean' } } })
  if (values.help || !positionals.length) { console.log('Doubao ASR — Node.js >=22; bundled dependencies\n  doctor | download --video <URL> --out <new-directory>\n  prepare --audio <path> --title <original> --source <bilibili|youtube> --video-id <id> --out <new-directory>\n  inspect --job <path> --chunk <id> [--offset 0] [--limit 10]\nOptions: --credential-file, --cache-dir, --language auto|zh-CN, --page, --chunk-tokens, --tail-timeout, --retry, --import-response'); return }
  const args = Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/-([a-z])/g, (_m, c) => c.toUpperCase()), value]))
  const controller = new AbortController(), cancel = () => controller.abort()
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel)
  args.signal = controller.signal; args.onProgress = event => console.error(JSON.stringify(event))
  args.sourceCli ??= join(scriptDirectory, 'video-source.cjs')
  const required = keys => { for (const key of keys) if (!args[key]) throw new Failure('DOUBAO_INPUT_INVALID') }
  try {
    let result
    if (positionals[0] === 'doctor') {
      let configured = true; try { await readKey(args.credentialFile ?? CONFIG) } catch { configured = false }
      result = { ready: configured, keyConfigured: configured, runtime: 'node', nodeVersion: process.versions.node, resourceId: RESOURCE, serviceActivation: 'verify separately; no network request made' }
    } else if (positionals[0] === 'download') { required(['video', 'out']); result = await downloadAudio(args) }
    else if (positionals[0] === 'inspect') {
      required(['job', 'chunk']); const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 10)
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20 || !/^\d+$/.test(args.chunk)) throw new Failure('DOUBAO_INVALID_METADATA_PAGE')
      const value = await json(join(args.job, 'asr/chunks', args.chunk + '.json')), rows = value.utterances
      result = { chunkId: value.chunkId, offset, utterances: rows.slice(offset, offset + limit), nextOffset: offset + limit < rows.length ? offset + limit : null }
    } else if (positionals[0] === 'prepare') {
      required(['audio', 'title', 'source', 'videoId', 'out'])
      for (const [key, fallback] of [['page', 1], ['chunkTokens', 3000], ['tailTimeout', 120]]) args[key] = Number(args[key] ?? fallback)
      result = await prepare(args)
    } else throw new Failure('DOUBAO_UNKNOWN_COMMAND')
    console.log(JSON.stringify(result))
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel) }
}
