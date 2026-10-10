import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defaultAuthFile, startLogin, pollLogin, importSession, readSession, checkSession, request } from './auth'
import { localTranscript, parseVideo, prepareArtifacts } from './prepare'
import { resolveSubtitleConfig } from '../config'
import { fetchTranscript } from '../subtitles'

const help = `video-summarizer source CLI — Node.js >=22; no LLM API required
  auth login --out <new-private-directory>         Generate login.png and login.json
  auth poll --state <login.json> [--wait]           Check once, or poll for <=180s
  auth import --file <cookie-file|->               Read raw SESSDATA / cookie header / JSON / Netscape
  auth status                                     Verify SESSDATA via Bilibili nav
  prepare --video <URL|BV|av|YouTubeID> --out <new-directory>
  prepare --transcript <txt|json> --out <new-directory> [--title <title>]
  inspect --manifest <manifest.json> [--offset 0] [--limit 20]  Bounded manifest page
Options: --auth-file <path>, --chunk-tokens <128..16000; default 3000>,
         --source <bilibili|youtube>, --page <positive integer>
Auth precedence: BILIBILI_SESSION_TOKEN (one SESSDATA value), then --auth-file,
then ~/.config/video-summarizer/bilibili.json. Import/poll writes the chosen file.
Only manifest path/status is printed. Transcript and chunks are stored on disk.
Existing output directories are rejected. Plain text is assumed to be a transcript;
JSON must have the repository's TranscriptResult shape. No ASR/video download.
`

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean' }, wait: { type: 'boolean' },
    out: { type: 'string' }, state: { type: 'string' }, file: { type: 'string' },
    'auth-file': { type: 'string' }, video: { type: 'string' }, transcript: { type: 'string' },
    title: { type: 'string' }, 'chunk-tokens': { type: 'string' }, source: { type: 'string' }, page: { type: 'string' },
    manifest: { type: 'string' }, offset: { type: 'string' }, limit: { type: 'string' },
  } })
  if (values.help || !positionals.length) { console.log(help); return }
  const authFile = resolve(values['auth-file'] ?? defaultAuthFile())
  const required = (name: 'out' | 'state' | 'file') => {
    const value = values[name]
    if (!value) throw new Error(`MISSING_OPTION: --${name}`)
    return value
  }
  let result: unknown
  if (positionals[0] === 'auth') {
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
      if (token) await checkSession(token)
      const config = resolveSubtitleConfig({ bilibiliSessionTokens: token ? [token] : [] })
      // No LLM imports, credentials or requests on the preparation path.
      transcript = await fetchTranscript({ video, options: { showTimestamp: true } }, config, {
        config, fetch: (url, init) => request(String(url), init),
        logger: { debug() {}, info() {}, warn() {}, error() {} },
      })
      provenance = { kind: 'platform-captions', ...video }
    }
    result = await prepareArtifacts(transcript, out, Number(values['chunk-tokens'] ?? 3000), provenance)
  } else throw new Error('UNKNOWN_COMMAND')
  console.log(JSON.stringify(result))
}

main().catch(error => {
  // Platform responses / cookie values are never dumped, including nested causes.
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  console.error(JSON.stringify({ error: error instanceof SyntaxError ? 'INVALID_JSON' : message }))
  process.exitCode = 1
})
