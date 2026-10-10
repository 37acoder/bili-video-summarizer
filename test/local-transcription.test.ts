import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, rm, readdir, stat, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { createVideoSummarizer } from '../src/summarizer'
import { getCacheId } from '../src/cache'
import { fetchTranscriptWithLocal } from '../src/transcription/fetch'
import { doctorLocalTranscription, setupLocalTranscription } from '../src/transcription/environment'
import { resolveSubtitleConfig } from '../src/config'
import { prepareArtifacts } from '../src/agent/prepare'
import type { LocalTranscriptionOptions } from '../src/transcription/types'
import type { SummarizeInput } from '../src/types'

const dirs: string[] = []
const run = promisify(execFile)
const video = { source: 'bilibili' as const, videoId: 'BV12ftJ6rEkw', pageNumber: 2 }
const input: SummarizeInput = { video, options: { showTimestamp: true } }
const config = resolveSubtitleConfig({ bilibiliSessionTokens: ['private-test-session'] })
const logger = { debug() {}, info() {}, warn() {}, error() {} }
const response = (value: unknown) => new Response(JSON.stringify(value))
function captions(mode: 'absent' | 'available' | 'thin' | 'http' | 'auth' | 'malformed' | 'wrong') {
  return (async (url: string | URL | Request) => {
    const path = String(url)
    if (mode === 'http') return new Response('', { status: 403 })
    if (path.includes('/nav')) return response({ code: mode === 'auth' ? -101 : 0, data: { isLogin: mode !== 'auth' } })
    if (path.includes('/view')) return response({ code: 0, data: { aid: 1, title: 'fixture', pages: [{ page: 1, cid: 11, duration: 40 }, { page: 2, cid: 22, duration: 20 }] } })
    if (path.includes('/player')) return response({ code: 0, data: { subtitle: { subtitles: mode === 'malformed' ? undefined : ['available', 'thin', 'wrong'].includes(mode) ? [{ lan: 'zh-CN', subtitle_url: 'https://captions.test/file' }] : [] } } })
    return response({ body: [{ from: mode === 'wrong' ? 100 : 19, content: mode === 'thin' ? '短' : '已有字幕'.repeat(100) }] })
  }) as typeof fetch
}

/** Actual subprocesses implement the tool protocol; no production function mocks. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'video-asr-integration-')); dirs.push(dir)
  const model = Buffer.alloc(1024 * 1024); model.writeUInt32LE(0x67676d6c); model.writeUInt32LE(51865, 4)
  const modelPath = join(dir, 'existing-model.bin'); await writeFile(modelPath, model)
  const script = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path');
const dir = __dirname, args = process.argv.slice(2), tool = path.basename(process.argv[1]);
if (args.includes('--version') || args.includes('-version')) { console.log('fixture 1.0'); process.exit(0) }
const mode = fs.existsSync(path.join(dir,'mode')) ? fs.readFileSync(path.join(dir,'mode'),'utf8') : '';
fs.appendFileSync(path.join(dir,'calls.jsonl'), JSON.stringify({tool,args})+'\\n');
if (mode === 'download-fail' && tool === 'yt-dlp') { console.error('private-test-session signed-url'); process.exit(1) }
if (tool === 'yt-dlp') {
 const cookie = args[args.indexOf('--cookies')+1];
 fs.writeFileSync(path.join(dir,'cookie-check.json'),JSON.stringify({private: (fs.statSync(cookie).mode & 511) === 384, valid:fs.readFileSync(cookie,'utf8').includes('private-test-session'), url:args.at(-1), cookie}));
 const out=args[args.indexOf('-o')+1].replace('%(ext)s','m4a');
 fs.writeFileSync(out,'audio fixture');fs.writeFileSync(out.replace('.m4a','.info.json'), JSON.stringify({ext:'m4a',duration:20,title:'fixture',url:'signed-url'}));
} else if (tool === 'ffprobe') console.log('20');
else if (tool === 'ffmpeg') fs.writeFileSync(args.at(-1),'wav fixture');
else {
 const out=args[args.indexOf('-of')+1];
 const finish=()=>{const texts=['开头条件与数字一百','中间论证和例子','最后结论与否定'];const transcription=mode==='empty'?[]:texts.map((text,i)=>({text:text.repeat(35),offsets:{from:i*8000,to:Math.min(i*8000+4000,20000)}}));
 fs.writeFileSync(out+'.json',JSON.stringify({result:{language:'zh'},transcription}));fs.writeFileSync(out+'.srt','1\\n00:00:00,000 --> 00:00:04,000\\n开头\\n');fs.writeFileSync(out+'.txt',texts.join(' '));};
 if(mode==='cancel') setTimeout(finish,10000);else finish();
}`
  const tools = { ytDlp: join(dir, 'yt-dlp'), ffmpeg: join(dir, 'ffmpeg'), ffprobe: join(dir, 'ffprobe'), whisperCli: join(dir, 'whisper-cli') }
  for (const file of Object.values(tools)) await writeFile(file, script, { mode: 0o700 })
  const options: LocalTranscriptionOptions = { modelPath, cacheDir: join(dir, 'cache'), configFile: join(dir, 'asr.json'), tools }
  const calls = async () => (await readFile(join(dir, 'calls.jsonl'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { tool: string; args: string[] })
  return { dir, options, calls, setMode: (mode: string) => writeFile(join(dir, 'mode'), mode) }
}
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

describe('optional local transcription integration', () => {
  it('keeps captions and short captions independent of an absent ASR environment; rejects upstream and identity failures', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'no-asr-')); dirs.push(dir)
    // Malformed ASR config would fail if a doctor/config read occurred.
    const file = join(dir, 'asr.json'); await writeFile(file, '{broken')
    const local = { configFile: file }
    for (const mode of ['available', 'thin'] as const) {
      const result = await fetchTranscriptWithLocal(input, config, { config, fetch: captions(mode), logger }, local)
      expect(result.captionStatus).toBe('available'); expect(result.transcription).toBeUndefined()
    }
    for (const mode of ['http', 'malformed', 'wrong', 'auth'] as const) await expect(fetchTranscriptWithLocal(input, config, { config, fetch: captions(mode), logger }, local)).rejects.toMatchObject({ code: mode === 'http' || mode === 'auth' ? 'UPSTREAM' : 'CAPTIONS_INVALID' })
    const summarizer = createVideoSummarizer({ localTranscription: local, fetch: captions('available'), subtitle: { bilibiliSessionTokens: ['private-test-session'] }, llmClient: { generate: async () => '正常字幕总结', stream: async () => (async function* () { yield '正常字幕总结' })() } })
    expect(await summarizer.summarize(input)).toBe('正常字幕总结')
  })

  it('transcribes the selected P2, preserves complete timing/artifacts, reuses stages, and shares API fallback/cache/stream behavior', async () => {
    const f = await fixture()
    const ctx = { config, fetch: captions('absent'), logger }
    const transcript = await fetchTranscriptWithLocal(input, config, ctx, f.options)
    expect(transcript.transcription).toMatchObject({ engine: 'whisper.cpp', detectedLanguage: 'zh', requestedLanguage: 'auto', audioDurationSeconds: 20, source: { pageNumber: 2 } })
    expect(transcript.subtitlesArray?.map(item => [item.s, item.e])).toEqual([[0, 4], [8, 12], [16, 20]])
    const cookie = JSON.parse(await readFile(join(f.dir, 'cookie-check.json'), 'utf8'))
    expect(cookie).toMatchObject({ private: true, valid: true }); expect(cookie.url).toContain('?p=2')
    await expect(stat(cookie.cookie)).rejects.toMatchObject({ code: 'ENOENT' })
    const prepared = await prepareArtifacts(transcript, join(f.dir, 'job'), 128, {})
    const manifest = JSON.parse(await readFile(prepared.manifest, 'utf8'))
    const chunks = await Promise.all(manifest.chunks.map(async (chunk: { file: string }) => JSON.parse(await readFile(join(f.dir, 'job', chunk.file), 'utf8'))))
    expect(chunks.flatMap(chunk => chunk.items).map(item => item.text).join('')).toBe(transcript.subtitlesArray!.map(item => item.text).join(''))
    expect(manifest.provenance.kind).toBe('local-asr')
    expect(await readFile(join(f.dir, 'job/asr/whisper.srt'), 'utf8')).toContain('-->')
    await expect(prepareArtifacts(transcript, join(f.dir, 'job'), 128, {})).rejects.toMatchObject({ code: 'EEXIST' })
    const llm = { generate: vi.fn(async () => '完整总结'), stream: vi.fn(async () => (async function* () { yield '完整'; yield '流式总结' })()) }
    const store = new Map([[getCacheId(input), '旧的缺字幕结果']])
    const cache = { get: async (key: string) => store.get(key), set: async (key: string, value: string) => store.set(key, value) }
    const api = createVideoSummarizer({ localTranscription: f.options, subtitle: { bilibiliSessionTokens: ['private-test-session'] }, fetch: ctx.fetch, llmClient: llm, cache })
    const prompt = await api.buildPrompt(input)
    expect(prompt.prompt).toContain('local automatic transcription'); expect(prompt.prompt).toContain('最后结论')
    expect(await api.summarize(input)).toContain('本地自动转录')
    let streamed = ''; for await (const part of await api.summarizeStream(input)) streamed += part
    expect(streamed).toContain('完整总结'); expect(llm.generate).toHaveBeenCalledTimes(1)
    const uncached = { ...input, options: { ...input.options, outputLanguage: 'en' } }
    let fresh = ''; for await (const part of await api.summarizeStream(uncached)) fresh += part
    expect(fresh).toContain('流式总结'); expect(llm.stream).toHaveBeenCalledTimes(1)
    expect((await f.calls()).filter(call => call.tool === 'yt-dlp')).toHaveLength(1)
    expect((await f.calls()).filter(call => call.tool === 'whisper-cli')).toHaveLength(1)
    // Language and changed model contents require new ASR, but reuse the audio.
    await fetchTranscriptWithLocal(input, config, ctx, { ...f.options, language: 'zh' })
    const bytes = await readFile(f.options.modelPath!); bytes[bytes.length - 1] = 1; await writeFile(f.options.modelPath!, bytes)
    await fetchTranscriptWithLocal(input, config, ctx, f.options)
    expect((await f.calls()).filter(call => call.tool === 'whisper-cli')).toHaveLength(3)
    expect((await f.calls()).filter(call => call.tool === 'yt-dlp')).toHaveLength(1)
    // Explicit provided input never extracts or runs ASR.
    expect((await api.buildPrompt({ ...input, transcript })).prompt).toContain('最后结论')
  })

  it('discloses missing items without installation; explicit setup reuses tools and writes private config; damaged downloads stay unusable', async () => {
    const f = await fixture()
    const options = { ...f.options, tools: { ...f.options.tools, ytDlp: join(f.dir, 'missing') } }
    const doctor = await doctorLocalTranscription(options)
    expect(doctor.ready).toBe(false); expect(doctor.missingTools).toEqual(['ytDlp'])
    await expect(fetchTranscriptWithLocal(input, config, { config, fetch: captions('absent'), logger }, options)).rejects.toMatchObject({ code: 'ASR_DEPENDENCIES_MISSING' })
    expect(await f.calls()).toEqual([])
    await cp(f.options.tools!.ytDlp!, options.tools.ytDlp)
    expect((await setupLocalTranscription(options)).ready).toBe(true)
    expect((await stat(f.options.configFile!)).mode & 0o777).toBe(0o600)
    expect((await doctorLocalTranscription({ configFile: f.options.configFile })).ready).toBe(true)
    expect(await f.calls()).toEqual([])
    vi.stubGlobal('fetch', async () => new Response('incomplete model'))
    await expect(setupLocalTranscription({ ...f.options, modelPath: undefined, model: 'small', configFile: join(f.dir, 'download.json') })).rejects.toMatchObject({ code: 'ASR_MODEL_INVALID' })
    expect(await readdir(join(f.options.cacheDir!, 'models'))).toEqual([])
    await writeFile(f.options.modelPath!, 'corrupt')
    expect((await doctorLocalTranscription(f.options)).model.status).toBe('invalid')
  })

  it('cleans failed downloads and cancelled/empty recognition without success markers, then retries using valid audio', async () => {
    const f = await fixture(), ctx = { config, fetch: captions('absent'), logger }
    await f.setMode('download-fail')
    await expect(fetchTranscriptWithLocal(input, config, ctx, f.options)).rejects.toMatchObject({ code: 'ASR_TOOL_FAILED' })
    const audioDir = join(f.options.cacheDir!, 'audio/bilibili/BV12ftJ6rEkw-p2')
    expect(await readdir(audioDir)).toEqual([])
    await f.setMode('empty')
    await expect(fetchTranscriptWithLocal(input, config, ctx, f.options)).rejects.toMatchObject({ code: 'ASR_INVALID_TRANSCRIPT' })
    expect(await readdir(audioDir)).toContain('complete.json')
    const transcriptRoot = join(f.options.cacheDir!, 'transcripts')
    for (const dir of await readdir(transcriptRoot)) expect(await readdir(join(transcriptRoot, dir))).toEqual([])
    await f.setMode('cancel')
    const abort = new AbortController()
    await expect(fetchTranscriptWithLocal(input, config, ctx, { ...f.options, signal: abort.signal, onProgress: event => { if (event.stage === 'transcribe' && event.status === 'started') setTimeout(() => abort.abort(), 30) } })).rejects.toMatchObject({ code: 'ASR_CANCELLED' })
    for (const dir of await readdir(transcriptRoot)) expect(await readdir(join(transcriptRoot, dir))).toEqual([])
    await f.setMode('')
    expect((await fetchTranscriptWithLocal(input, config, ctx, f.options)).subtitlesArray).toHaveLength(3)
    expect((await f.calls()).filter(call => call.tool === 'yt-dlp')).toHaveLength(2)
  })

  it.skipIf(process.platform !== 'darwin')('installs only the missing Homebrew package after explicit setup, then resumes the original video', async () => {
    const f = await fixture(), oldPath = process.env.PATH
    await cp(f.options.tools!.ytDlp!, join(f.dir, 'tool-template'))
    await rm(f.options.tools!.ytDlp!)
    const brew = `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2);if(args[0]==='--version'){console.log('fixture brew');process.exit(0)}if(args[0]==='--prefix'){console.log(__dirname);process.exit(0)}fs.writeFileSync(path.join(__dirname,'brew-packages.json'),JSON.stringify(args));fs.copyFileSync(path.join(__dirname,'tool-template'),path.join(__dirname,'yt-dlp'));fs.chmodSync(path.join(__dirname,'yt-dlp'),448);`
    const options = { ...f.options, tools: undefined }
    try {
      process.env.PATH = f.dir
      expect((await doctorLocalTranscription(options)).missingTools).toEqual(['ytDlp'])
      await expect(setupLocalTranscription(options)).rejects.toMatchObject({ code: 'ASR_SETUP_UNSUPPORTED' })
      await expect(stat(join(f.dir, 'yt-dlp'))).rejects.toMatchObject({ code: 'ENOENT' })
      await writeFile(join(f.dir, 'brew'), brew, { mode: 0o700 })
      // This explicit call represents the user's install choice; doctor/fallback never install.
      expect((await setupLocalTranscription(options)).ready).toBe(true)
      expect(JSON.parse(await readFile(join(f.dir, 'brew-packages.json'), 'utf8'))).toEqual(['install', 'yt-dlp'])
      expect((await fetchTranscriptWithLocal(input, config, { config, fetch: captions('absent'), logger }, options)).transcription?.model).toBe('existing-model.bin')
    } finally { process.env.PATH = oldPath }
  })

  it('runs the complete copied Skill outside the repo and uses an explicitly configured existing environment', async () => {
    const f = await fixture(), skill = join(f.dir, 'skill')
    await cp(join(process.cwd(), 'skills/video-summarizer'), skill, { recursive: true })
    const cli = join(skill, 'scripts/video-source.cjs')
    const args = ['--asr-config', f.options.configFile!, '--asr-cache-dir', f.options.cacheDir!, '--model-path', f.options.modelPath!, '--yt-dlp', f.options.tools!.ytDlp!, '--ffmpeg', f.options.tools!.ffmpeg!, '--ffprobe', f.options.tools!.ffprobe!, '--whisper-cli', f.options.tools!.whisperCli!]
    const result = await run(process.execPath, [cli, 'asr', 'doctor', ...args], { cwd: f.dir, env: { PATH: process.env.PATH } })
    expect(JSON.parse(result.stdout).ready).toBe(true)
    const setup = await run(process.execPath, [cli, 'asr', 'setup', ...args], { cwd: f.dir, env: { PATH: process.env.PATH } })
    expect(JSON.parse(setup.stdout).ready).toBe(true)
    expect(await f.calls()).toEqual([])
    expect(await readFile(join(skill, 'references/local-transcription.md'), 'utf8')).toContain('captions_absent')
    // Exercise the actual CLI branch signal and resume from the copied Skill.
    const auth = join(f.dir, 'auth.json'); await writeFile(auth, JSON.stringify({ SESSDATA: 'private-test-session' }), { mode: 0o600 })
    const preload = join(f.dir, 'platform.cjs')
    await writeFile(preload, `const fs=require('node:fs'),path=require('node:path');global.fetch=async u=>{const url=String(u),available=fs.existsSync(path.join(__dirname,'captioned'));let data;if(url.includes('/nav'))data={code:0,data:{isLogin:true}};else if(url.includes('/view'))data={code:0,data:{title:'fixture',aid:1,pages:[{page:2,cid:22,duration:20}]}};else if(url.includes('/player'))data={code:0,data:{subtitle:{subtitles:available?[{lan:'zh-CN',subtitle_url:'https://caption.test/file'}]:[]}}};else data={body:[{from:19,content:'已有字幕'.repeat(100)}]};return new Response(JSON.stringify(data));};`)
    const base = ['--require', preload, cli]
    const prepare = ['prepare', '--video', video.videoId, '--page', '2', '--auth-file', auth]
    try {
      await run(process.execPath, [...base, ...prepare, '--out', join(f.dir, 'absent')], { cwd: f.dir, env: { PATH: process.env.PATH } })
      throw new Error('Expected missing captions')
    } catch (error) {
      const parsed = JSON.parse((error as { stderr: string }).stderr)
      expect(parsed).toMatchObject({ error: 'NO_TRANSCRIPT', reason: 'captions_absent' })
    }
    await expect(stat(join(f.dir, 'absent'))).rejects.toMatchObject({ code: 'ENOENT' })
    // Declining setup leaves no new tools/media; choosing ready environment resumes the same request.
    expect(await f.calls()).toEqual([])
    const resumed = await run(process.execPath, [...base, ...prepare, '--asr', 'local', ...args, '--out', join(f.dir, 'resumed')], { cwd: f.dir, env: { PATH: process.env.PATH } })
    expect(JSON.parse(resumed.stdout).chunkCount).toBeGreaterThan(0)
    expect(resumed.stderr).not.toContain('private-test-session'); expect(resumed.stderr).not.toContain('signed-url')
    await writeFile(join(f.dir, 'captioned'), '')
    const badConfig = join(f.dir, 'broken.json'); await writeFile(badConfig, '{broken')
    const captioned = await run(process.execPath, [...base, ...prepare, '--asr', 'local', '--asr-config', badConfig, '--out', join(f.dir, 'captioned-job')], { cwd: f.dir, env: { PATH: process.env.PATH } })
    expect(JSON.parse(captioned.stdout).usedDescription).toBe(false)
    expect(captioned.stderr).toBe('')
    expect((await f.calls()).filter(call => call.tool === 'whisper-cli')).toHaveLength(1)
  })
})
