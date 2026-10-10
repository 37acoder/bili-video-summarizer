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
})
