import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { checkSession, importSession, pollLogin, startLogin } from '../src/agent/auth'
import { localTranscript, prepareArtifacts } from '../src/agent/prepare'
import { fetchTranscript } from '../src/subtitles'
import { resolveSubtitleConfig } from '../src/config'

const run = promisify(execFile)
const dirs: string[] = []
async function temp() { const dir = await mkdtemp(join(tmpdir(), 'video-skill-test-')); dirs.push(dir); return dir }
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })
const response = (body: unknown, headers?: Record<string, string>) => new Response(JSON.stringify(body), { headers })

describe('Agent source workflows (no LLM)', () => {
  it('QR pending/confirmation/success validates nav before saving and cleans temporary credentials', async () => {
    const dir = await temp()
    const auth = join(dir, 'auth.json')
    const codes = [86101, 86090, 0]
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/generate')) return response({ code: 0, data: { url: 'https://passport.bilibili.com/test', qrcode_key: 'test-key' } })
      if (String(url).includes('/poll')) return response({ code: 0, data: { code: codes.shift() } }, { 'Set-Cookie': 'SESSDATA=secret%2Cvalue; HttpOnly; Secure' })
      expect(String(url)).toContain('/nav')
      expect((init?.headers as Record<string, string>).Cookie).toBe('SESSDATA=secret%2Cvalue')
      return response({ code: 0, data: { isLogin: true } })
    }) as typeof fetch
    const started = await startLogin(join(dir, 'qr'), fetcher)
    expect((await readFile(started.qrFile)).subarray(1, 4).toString()).toBe('PNG')
    expect(await pollLogin(started.stateFile, auth, fetcher)).toEqual({ state: 'waiting_for_scan' })
    expect(await pollLogin(started.stateFile, auth, fetcher)).toEqual({ state: 'waiting_for_confirmation' })
    expect((await pollLogin(started.stateFile, auth, fetcher)).state).toBe('authenticated')
    expect(JSON.parse(await readFile(auth, 'utf8')).SESSDATA).toBe('secret%2Cvalue')
    expect((await stat(auth)).mode & 0o777).toBe(0o600)
    expect(await readdir(join(dir, 'qr'))).toEqual([])
    const expired = join(dir, 'expired.json')
    await writeFile(expired, JSON.stringify({ key: 'old', createdAt: 0 }))
    await expect(pollLogin(expired, auth, fetcher)).rejects.toThrow('QR_EXPIRED')
    await expect(checkSession('old', (async () => response({ code: -101 })) as typeof fetch)).rejects.toThrow('AUTH_INVALID')
  })

  it('imports browser state and Netscape cookies, rejects invalid login without overwriting credentials', async () => {
    const auth = join(await temp(), 'auth.json')
    const good = (async () => response({ code: 0, data: { isLogin: true } })) as typeof fetch
    await importSession(JSON.stringify({ cookies: [{ name: 'SESSDATA', value: 'one', domain: '.bilibili.com' }] }), auth, good)
    await importSession('# Netscape HTTP Cookie File\n#HttpOnly_.bilibili.com\tTRUE\t/\tTRUE\t0\tSESSDATA\ttwo', auth, good)
    await expect(importSession('invalid', auth, (async () => response({ code: -101 })) as typeof fetch)).rejects.toThrow('AUTH_INVALID')
    expect(JSON.parse(await readFile(auth, 'utf8')).SESSDATA).toBe('two')
  })

  it('authenticated caption extraction selects P2, keeps cookie off CDN, and produces bounded complete chunks', async () => {
    const dir = await temp()
    const config = resolveSubtitleConfig({ bilibiliSessionTokens: ['secret'] })
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes('/view')) return response({ code: 0, data: { title: 'test', aid: 1, pages: [{ page: 1, cid: 11, duration: 30 }, { page: 2, cid: 22, duration: 60 }] } })
      if (String(url).includes('/player')) {
        expect(String(url)).toContain('cid=22')
        expect((init?.headers as Record<string, string>).Cookie).toBe('SESSDATA=secret')
        return response({ code: 0, data: { subtitle: { subtitles: [{ lan: 'zh-CN', subtitle_url: 'https://caption.test/file' }] } } })
      }
      expect((init?.headers as Record<string, string>).Cookie).toBeUndefined()
      return response({ body: [{ from: 0, content: '开头信息'.repeat(500) }, { from: 59, content: '最后结论' }] })
    }) as typeof fetch
    const ctx = { config, fetch: fetcher, logger: { debug() {}, info() {}, warn() {}, error() {} } }
    const transcript = await fetchTranscript({ video: { source: 'bilibili', videoId: 'BV1KLhi6oEh5', pageNumber: 2 }, options: { showTimestamp: true } }, config, ctx)
    const result = await prepareArtifacts(transcript, join(dir, 'prepared'), 128, { test: true })
    const manifest = JSON.parse(await readFile(result.manifest, 'utf8'))
    let combined = ''
    for (const entry of manifest.chunks) {
      expect(entry.estimatedTextTokens).toBeLessThanOrEqual(128)
      expect(entry.estimatedFileTokens).toBeLessThanOrEqual(128)
      const chunk = JSON.parse(await readFile(join(dir, 'prepared', entry.file), 'utf8'))
      combined += chunk.items.map((item: { text: string }) => item.text).join('')
    }
    expect(combined).toBe(transcript.subtitlesArray!.map(item => item.text).join(''))
    const dense = { ...transcript, subtitlesArray: Array.from({ length: 500 }, (_, index) => ({ index, text: '字', s: index })) }
    const denseResult = await prepareArtifacts(dense, join(dir, 'dense'), 128, {})
    const denseManifest = JSON.parse(await readFile(denseResult.manifest, 'utf8'))
    expect(denseManifest.itemCount).toBe(500)
    expect(denseManifest.chunks.every((chunk: { estimatedFileTokens: number }) => chunk.estimatedFileTokens <= 128)).toBe(true)
    await expect(fetchTranscript({ video: { source: 'bilibili', videoId: 'BV1KLhi6oEh5', pageNumber: 3 } }, config, ctx)).rejects.toThrow('page does not exist')
    await expect(prepareArtifacts({ ...transcript, usedDescription: true }, join(dir, 'missing'), 128, {})).rejects.toThrow('NO_TRANSCRIPT')
  })

  it('runs packaged CLI outside the repo without API keys or node_modules, blocks description-only input', async () => {
    const dir = await temp()
    const script = join(process.cwd(), 'skills/video-summarizer/scripts/video-source.cjs')
    const input = join(process.cwd(), 'examples/samples/BV1KLhi6oEh5.input.txt')
    const result = await run(process.execPath, [script, 'prepare', '--transcript', input, '--out', join(dir, 'out'), '--chunk-tokens', '128'], {
      cwd: dir, env: { PATH: process.env.PATH },
    })
    expect(JSON.parse(result.stdout).chunkCount).toBeGreaterThan(1)
    expect(result.stdout).not.toContain('这是我那天')
    const inspected = await run(process.execPath, [script, 'inspect', '--manifest', join(dir, 'out/manifest.json'), '--limit', '2'], { cwd: dir })
    expect(JSON.parse(inspected.stdout).chunks).toHaveLength(2)
    expect(JSON.parse(inspected.stdout).nextOffset).toBe(2)
    const transcript = await localTranscript(input)
    await writeFile(join(dir, 'description.json'), JSON.stringify({ ...transcript, usedDescription: true }))
    await expect(run(process.execPath, [script, 'prepare', '--transcript', join(dir, 'description.json'), '--out', join(dir, 'bad')], { cwd: dir })).rejects.toMatchObject({ code: 1 })
  })

  it('retries invalid captions in one foreground CLI, preserves output, and stops at the configured bound', async () => {
    const dir = await temp(), script = join(process.cwd(), 'skills/video-summarizer/scripts/video-source.cjs')
    const preload = join(dir, 'fetch.mjs'), record = join(dir, 'calls.json'), broken = join(dir, 'asr.json')
    await writeFile(broken, '{broken')
    await writeFile(preload, `import {writeFileSync} from 'node:fs';
let views=0;const r=x=>new Response(JSON.stringify(x));
globalThis.fetch=async url=>{
 const path=String(url);
 if(path.includes('/nav'))return r({code:0,data:{isLogin:true}});
 if(path.includes('/view')){views++;writeFileSync(${JSON.stringify(record)},JSON.stringify({views}));
  return r({code:0,data:views===1||process.env.TEST_ALWAYS_INVALID?{title:'invalid'}:{aid:1,title:'fixture',pages:[{page:1,cid:11,duration:20}]}});}
 if(path.includes('/player'))return r({code:0,data:{subtitle:{subtitles:[{lan:'zh-CN',subtitle_url:'https://caption.test/file'}]}}});
 return r({body:[{from:0,content:'开头条件'.repeat(100)},{from:19,content:'最后结论'}]});
};`)
    const args = ['--import', preload, script, 'prepare', '--video', 'BV12ftJ6rEkw', '--caption-retries', '2', '--asr', 'local', '--asr-config', broken]
    const env = { PATH: process.env.PATH, BILIBILI_SESSION_TOKEN: 'fixture-session' }
    const output = join(dir, 'out')
    const success = await run(process.execPath, [...args, '--out', output], { cwd: dir, env })
    expect(JSON.parse(success.stdout).usedDescription).toBe(false)
    expect(success.stderr.match(/caption-retry/g)).toHaveLength(1)
    expect(JSON.parse(await readFile(record, 'utf8')).views).toBe(2)
    const manifest = await readFile(join(output, 'manifest.json'), 'utf8')
    await expect(run(process.execPath, [...args, '--out', output], { cwd: dir, env })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('OUTPUT_EXISTS') })
    expect(await readFile(join(output, 'manifest.json'), 'utf8')).toBe(manifest)
    const failedOut = join(dir, 'failed')
    await expect(run(process.execPath, [...args, '--out', failedOut], { cwd: dir, env: { ...env, TEST_ALWAYS_INVALID: '1' } })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('CAPTIONS_INVALID') })
    expect(JSON.parse(await readFile(record, 'utf8')).views).toBe(3)
    await expect(stat(failedOut)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(broken, 'utf8')).toBe('{broken')
  })

  it('does not retry HTTP, caption JSON, auth or cancellation failures and keeps absence distinct', async () => {
    const dir = await temp(), script = join(process.cwd(), 'skills/video-summarizer/scripts/video-source.cjs')
    const preload = join(dir, 'fetch.mjs'), record = join(dir, 'calls.json')
    await writeFile(preload, `import {writeFileSync} from 'node:fs';
let views=0;const mode=process.env.TEST_MODE,r=x=>new Response(JSON.stringify(x));
globalThis.fetch=async url=>{
 const path=String(url);
 if(path.includes('/nav'))return r({code:mode==='auth'?-101:0,data:{isLogin:mode!=='auth'}});
 if(path.includes('/view')){views++;writeFileSync(${JSON.stringify(record)},JSON.stringify({views}));
  if(mode==='cancel'){setTimeout(()=>process.kill(process.pid,'SIGINT'),50);return r({code:0,data:{title:'invalid'}});}
  return r({code:0,data:{aid:1,title:'fixture',pages:[{page:1,cid:11,duration:20}]}});}
 if(path.includes('/player'))return r({code:0,data:{subtitle:{subtitles:mode==='absent'?[]:[{lan:'zh-CN',subtitle_url:'https://caption.test/file'}]}}});
 return mode==='http'?new Response('',{status:403}):new Response('{broken');
};`)
    for (const [mode, error] of [['http', 'UPSTREAM'], ['json', 'INVALID_JSON'], ['auth', 'AUTH_INVALID'], ['cancel', 'Abort'], ['absent', 'NO_TRANSCRIPT']] as const) {
      const out = join(dir, mode)
      await expect(run(process.execPath, ['--import', preload, script, 'prepare', '--video', 'BV12ftJ6rEkw', '--out', out, '--caption-retries', '3'], {
        cwd: dir, env: { PATH: process.env.PATH, BILIBILI_SESSION_TOKEN: 'fixture-session', TEST_MODE: mode },
      })).rejects.toMatchObject({ code: 1, stderr: expect.stringMatching(new RegExp(error, 'i')) })
      if (mode !== 'auth') expect(JSON.parse(await readFile(record, 'utf8')).views).toBe(1)
      await expect(stat(out)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  })

  it('verifies chapter evidence through the packaged CLI and rejects a late anchor even with a valid sidecar quote', async () => {
    const dir = await temp(), script = join(process.cwd(), 'skills/video-summarizer/scripts/video-source.cjs')
    const input = join(dir, 'input.txt'); await writeFile(input, '[00:49] 第一条要点\n[01:55] 第二条要点\n' + '更多上下文'.repeat(40))
    const output = join(dir, 'output')
    await run(process.execPath, [script, 'prepare', '--transcript', input, '--title', '测试', '--out', output])
    const summary = join(output, 'summary.md'), chapters = join(output, 'chapters.json')
    await writeFile(summary, '# 测试\n### [01:55] 主题\n- 第一条要点（item 0）\n- 第二条要点（item 1）\n')
    await writeFile(chapters, JSON.stringify([{ heading: '主题', sourceItemIndex: 1, sourceStartSeconds: 115, sourceQuote: '第二条要点' }]))
    const args = [script, 'verify-summary', '--manifest', join(output, 'manifest.json'), '--summary', summary, '--chapters', chapters]
    await expect(run(process.execPath, args)).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('CHAPTER_START_AFTER_CITED_CONTENT') })
    await writeFile(summary, '# 测试\n### [00:49] 主题\n- 第一条要点（item 0）\n- 第二条要点（item 1）\n')
    await writeFile(chapters, JSON.stringify([{ heading: '主题', sourceItemIndex: 0, sourceStartSeconds: 49, sourceQuote: '第一条要点' }]))
    expect(JSON.parse((await run(process.execPath, args)).stdout).valid).toBe(true)
    await writeFile(summary, '# 测试\n### [00:49] 主题\n- 原文应为猜测（item 0）\n')
    await expect(run(process.execPath, args)).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('CORRECTION_REQUIRES_REVIEW') })
  })
})
