import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { mkdtemp, readFile, writeFile, readdir, rm, stat, cp, realpath, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gzipSync, gunzipSync } from 'node:zlib'
import { WebSocketServer } from 'ws'
import { prepare, downloadAudio, sha256, RESOURCE, PARAMETERS } from '../scripts/doubao-transcribe.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = promisify(execFile)
const fakeKey = 'integration-only-not-a-real-secret'
const response = () => {
  const rows = [{ text: '合成测试文字用于验证长句分块。'.repeat(45), start_time: 0, end_time: 900, definite: true,
    words: [{ text: '合成', start_time: 0, end_time: 100 }], additions: { speaker_id: '0', emotion: 'neutral', gender: 'female', speech_rate: '3.1', volume: '70', lid_lang: 'speech_mand', future_field: { keep: true } } },
  { text: '第二位说话人的合成测试句子。', start_time: 1000, end_time: 1999, definite: true, words: [], additions: { speaker_id: '1', emotion: 'happy' } }]
  return { code: 0, is_last_package: true, payload_msg: { audio_info: { duration: 2000 }, result: { text: rows.map(u => u.text).join(''), utterances: rows } } }
}
const wire = (body, last = false) => {
  const data = gzipSync(Buffer.from(JSON.stringify(body))), header = Buffer.from([0x11, last ? 0x93 : 0x91, 0x11, 0, 0, 0, 0, 1, 0, 0, 0, 0])
  header.writeInt32BE(last ? -1 : 1, 4); header.writeUInt32BE(data.length, 8)
  return Buffer.concat([header, data])
}
let root, audio, server, sockets, endpoint, calls, packets, requests, mode, errors, previousKey
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'doubao-node-integration-')); audio = join(root, 'input.wav')
  const wav = Buffer.alloc(64044)
  wav.write('RIFF'); wav.writeUInt32LE(64036, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(64000, 40)
  await writeFile(audio, wav)
  calls = packets = 0; requests = []; errors = []; mode = 'success'
  previousKey = process.env.DOUBAO_ASR_API_KEY; process.env.DOUBAO_ASR_API_KEY = fakeKey
  server = createServer(); sockets = new WebSocketServer({ noServer: true })
  server.on('upgrade', (request, socket, head) => {
    calls++
    if (mode === 'denied') { socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'); return }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request))
  })
  sockets.on('connection', (ws, request) => {
    let first = true, nextSequence = 2, received = Buffer.alloc(0)
    ws.on('message', async data => {
      try {
        expect(request.headers['x-api-key']).toBe(fakeKey); expect(request.headers['x-api-resource-id']).toBe(RESOURCE)
        expect(data.readUInt32BE(8)).toBe(data.length - 12)
        const body = gunzipSync(data.subarray(12))
        if (first) {
          first = false; expect([...data.subarray(0, 4)]).toEqual([0x11, 0x11, 0x11, 0]); expect(data.readInt32BE(4)).toBe(1)
          requests.push(JSON.parse(body)); ws.send(wire({ result: { text: '' } })); return
        }
        const last = (data[1] & 15) === 3
        expect(data[1] >> 4).toBe(2); expect(data.readInt32BE(4)).toBe(last ? -nextSequence : nextSequence)
        nextSequence++; packets++; received = Buffer.concat([received, body])
        if (last) {
          expect(received).toEqual(await readFile(audio))
          if (mode === 'success') { ws.send(wire({ result: { text: '临时更新' } })); ws.send(wire(response().payload_msg, true)) }
          if (mode !== 'hang') ws.close()
        }
      } catch (error) { errors.push(error); ws.terminate() }
    })
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  endpoint = `ws://127.0.0.1:${server.address().port}/asr`
})
afterEach(async () => {
  if (previousKey === undefined) delete process.env.DOUBAO_ASR_API_KEY; else process.env.DOUBAO_ASR_API_KEY = previousKey
  for (const client of sockets.clients) client.terminate()
  await new Promise(done => sockets.close(done)); await new Promise(done => server.close(done))
  await rm(root, { recursive: true, force: true })
})
const args = name => ({ audio, out: join(root, name), sourceCli: join(repository, 'skills/video-summarizer/scripts/video-source.cjs'),
  cacheDir: join(root, 'cache'), source: 'bilibili', videoId: 'BV12ftJ6rEkw', title: '保留的原标题', page: 2, chunkTokens: 128,
  credentialFile: join(root, 'missing-key.json'), tailTimeout: 5 })
async function attempts() {
  const folders = await readdir(join(root, 'cache'))
  return JSON.parse(await readFile(join(root, 'cache', folders.find(f => !f.startsWith('.')), 'attempt.json'), 'utf8'))
}
async function checkJob(name) {
  const job = join(root, name), manifest = JSON.parse(await readFile(join(job, 'manifest.json'), 'utf8'))
  expect(manifest.chunkCount).toBeGreaterThan(2); expect(manifest.title).toBe('保留的原标题'); expect(manifest.provenance.source.pageNumber).toBe(2)
  const raw = JSON.parse(await readFile(join(job, 'asr/doubao-response.json'), 'utf8')); expect(raw).toEqual(response())
  expect((await stat(join(job, 'asr/complete.json'))).isFile()).toBe(true)
  let text = ''; const seen = new Set()
  for (const chunk of manifest.chunks) {
    const block = JSON.parse(await readFile(join(job, chunk.file), 'utf8')), rich = JSON.parse(await readFile(join(job, chunk.asrMetadataFile), 'utf8'))
    expect(chunk.estimatedFileTokens).toBeLessThanOrEqual(128)
    for (const item of block.items) {
      const matches = rich.utterances.filter(u => item.index >= u.firstItemIndex && item.index <= u.lastItemIndex)
      expect(matches).toHaveLength(1); const u = matches[0], original = response().payload_msg.result.utterances[u.utteranceIndex]
      expect(u.additions.speaker_id).toBe(original.additions.speaker_id); expect([u.s, u.e]).toEqual([original.start_time / 1000, original.end_time / 1000])
      text += item.text; seen.add(u.utteranceIndex)
    }
  }
  expect([...seen]).toEqual([0, 1]); expect(text).toBe(response().payload_msg.result.text)
  for (const file of await readdir(root, { recursive: true })) {
    if (file.endsWith('.json')) expect(await readFile(join(root, file), 'utf8')).not.toContain(fakeKey)
  }
  expect(errors).toEqual([])
  return manifest
}
describe('Node Doubao workflows (local transport, no paid service)', () => {
  it('retains rich chunks, reuses cache without a key, and imports offline in a portable package', async () => {
    const originalHash = await sha256(audio), progress = []
    expect((await prepare({ ...args('first'), onProgress: value => progress.push(value) }, { endpoint })).cached).toBe(false)
    await checkJob('first'); expect(requests[0].request).toEqual(PARAMETERS); expect(JSON.stringify(progress)).not.toContain(fakeKey)
    delete process.env.DOUBAO_ASR_API_KEY
    expect((await prepare(args('cached'), { endpoint })).cached).toBe(true); await checkJob('cached'); expect(calls).toBe(1)
    const skill = join(root, 'portable skill'); await cp(join(repository, 'skills/video-summarizer'), skill, { recursive: true })
    const wrapper = join(skill, 'scripts/video.mjs'), imported = join(root, 'import.json'); await writeFile(imported, JSON.stringify(response()))
    const environment = JSON.parse((await run(process.execPath, [wrapper, 'env'], { cwd: root })).stdout)
    expect(environment).toMatchObject({ ready: true, skillDirectory: await realpath(skill), entrypoint: await realpath(wrapper) })
    const result = await run(process.execPath, [wrapper, 'doubao', 'prepare', '--audio', audio, '--title', '保留的原标题', '--source', 'bilibili', '--video-id', 'BV12ftJ6rEkw', '--page', '2', '--out', join(root, 'imported'), '--chunk-tokens', '128', '--cache-dir', join(root, 'cache'), '--import-response', imported], { cwd: root, env: { PATH: process.env.PATH } })
    expect(JSON.parse(result.stdout).cached).toBe(false)
    const manifest = await checkJob('imported'); expect(manifest.provenance.imported).toBe(true); expect(manifest.provenance.requestId).toBeNull()
    const inspected = await run(process.execPath, [wrapper, 'doubao', 'inspect', '--job', join(root, 'first'), '--chunk', '0001', '--limit', '1'], { cwd: root })
    expect(JSON.parse(inspected.stdout).utterances).toHaveLength(1)
    await expect(run(process.execPath, [wrapper, 'doubao', 'prepare', '--audio', audio, '--title', '保留的原标题', '--source', 'bilibili', '--video-id', 'BV12ftJ6rEkw', '--out', join(root, 'imported'), '--import-response', imported])).rejects.toMatchObject({ code: 1 })
    expect(await sha256(audio)).toBe(originalHash); expect(calls).toBe(1)
  })
  it('rejects before audio and requires explicit retry even in another output directory', async () => {
    mode = 'denied'; await expect(prepare(args('denied'), { endpoint })).rejects.toThrow('AUTH_OR_SERVICE_DENIED')
    expect(await attempts()).toMatchObject({ status: 'rejected_before_audio', audio_packets_sent: 0 })
    await expect(stat(join(root, 'denied'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(prepare(args('other-out'), { endpoint })).rejects.toThrow('PREVIOUS_ATTEMPT'); expect(calls).toBe(1)
    mode = 'success'; await prepare({ ...args('retry'), retry: true }, { endpoint }); expect(calls).toBe(2)
  })
  it('keeps interrupted uploads incomplete and does not silently resend', async () => {
    mode = 'incomplete'; await expect(prepare(args('partial'), { endpoint })).rejects.toThrow('TERMINAL_RESPONSE_MISSING')
    expect(await attempts()).toMatchObject({ status: 'incomplete_outcome_unknown' }); expect(packets).toBeGreaterThan(0)
    const files = await readdir(join(root, 'cache'), { recursive: true }); expect(files.some(f => f.endsWith('complete.json'))).toBe(false)
    await expect(prepare(args('other-out'), { endpoint })).rejects.toThrow('PREVIOUS_ATTEMPT'); expect(calls).toBe(1)
  })
  it('cancels a pending stream and preserves the unknown outcome without completion', async () => {
    mode = 'hang'; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 350)
    try { await expect(prepare({ ...args('cancelled'), signal: controller.signal }, { endpoint })).rejects.toThrow('CANCELLED') }
    finally { clearTimeout(timer) }
    expect(await attempts()).toMatchObject({ status: 'incomplete_outcome_unknown' })
    await expect(prepare(args('other-out'), { endpoint })).rejects.toThrow('PREVIOUS_ATTEMPT')
  })
  it('downloads only selected Bilibili audio, keeps the title and cleans private staging', async () => {
    const cookieValue = 'fake-bili-cookie-only', config = join(root, 'bili.json'); await writeFile(config, JSON.stringify({ SESSDATA: cookieValue }))
    const stages = []
    const value = await downloadAudio({ video: 'https://www.bilibili.com/video/BV12ftJ6rEkw/?p=2', out: join(root, 'download'), authFile: config, ytDlp: 'mock-yt-dlp', ffprobe: 'mock-ffprobe' }, {
      fetch: async (url, options) => {
        expect(options.headers.Cookie).toBe('SESSDATA=' + cookieValue); expect(url).toMatch(/^https:\/\/api.bilibili.com\//)
        return new Response(JSON.stringify({ code: 0, data: url.endsWith('/nav') ? { isLogin: true } : { title: '保留的原标题', pages: [{ page: 1, duration: 99, cid: 123 }, { page: 2, duration: 2, cid: 456 }] } }))
      },
      tool: async command => {
        if (command[0] === 'mock-ffprobe') return '2.0\n'
        const stage = dirname(command[command.indexOf('-o') + 1]); stages.push(stage)
        expect((await stat(command[command.indexOf('--cookies') + 1])).mode & 0o777).toBe(0o600)
        expect(command.join(' ')).not.toContain(cookieValue); expect(command.at(-1)).toMatch(/\/?p=2$/)
        await writeFile(join(stage, 'audio.wav'), await readFile(audio))
        await writeFile(join(stage, 'audio.info.json'), JSON.stringify({ id: '456', ext: 'wav', title: '被下载器改写的标题', duration: 2, url: 'https://signed.invalid/?secret=hidden' }))
        return ''
      },
    })
    expect(value).toMatchObject({ title: '保留的原标题', pageNumber: 2, cid: 456 }); expect(await sha256(value.audio)).toBe(await sha256(audio))
    for (const stage of stages) await expect(stat(stage)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await readdir(join(root, 'download'))).sort()).toEqual(['audio-source.json', 'audio.wav'])
    const metadata = await readFile(value.metadata, 'utf8'); expect(metadata).not.toContain(cookieValue); expect(metadata).not.toContain('signed.invalid')
  })
  it('reuses a Python-version cache key without reuploading or requiring credentials', async () => {
    const fixture = JSON.parse(await readFile(join(repository, 'test/fixtures/doubao-legacy-cache.json'), 'utf8'))
    expect(await sha256(audio)).toBe(fixture.audioSha256)
    const cache = join(root, 'cache', fixture.cacheId); await mkdir(cache, { recursive: true })
    await writeFile(join(cache, 'response.json'), JSON.stringify(response()))
    await writeFile(join(cache, 'complete.json'), JSON.stringify({ requestId: 'legacy-fixture', responseSha256: await sha256(join(cache, 'response.json')) }))
    delete process.env.DOUBAO_ASR_API_KEY
    expect((await prepare(args('legacy'), { endpoint })).cached).toBe(true)
    const manifest = await checkJob('legacy'); expect(manifest.provenance.requestId).toBe('legacy-fixture'); expect(calls).toBe(0)
  })
  it('rejects a download whose selected page cannot be verified', async () => {
    const config = join(root, 'bili.json'); await writeFile(config, JSON.stringify({ SESSDATA: 'fixture-cookie' }))
    const output = join(root, 'unverified-page')
    await expect(downloadAudio({ video: 'https://www.bilibili.com/video/BV12ftJ6rEkw/?p=2', out: output, authFile: config }, {
      fetch: async url => new Response(JSON.stringify({ code: 0, data: url.endsWith('/nav') ? { isLogin: true } : { title: '原标题', pages: [{ page: 2, duration: 2, cid: 456 }] } })),
      tool: async command => {
        const stage = dirname(command[command.indexOf('-o') + 1])
        await writeFile(join(stage, 'audio.wav'), await readFile(audio))
        await writeFile(join(stage, 'audio.info.json'), JSON.stringify({ id: 'BV12ftJ6rEkw', ext: 'wav', duration: 2 }))
        return ''
      },
    })).rejects.toThrow('DOUBAO_PAGE_UNVERIFIED')
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await readdir(root)).some(f => f.startsWith('.doubao-download-'))).toBe(false)
  })
})
