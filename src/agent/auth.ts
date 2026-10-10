import { mkdir, readFile, writeFile, rename, chmod, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { DEFAULT_USER_AGENT } from '../config'

export const defaultAuthFile = () => join(homedir(), '.config', 'video-summarizer', 'bilibili.json')
const passport = 'https://passport.bilibili.com/x/passport-login/web/qrcode'
const headers = { 'User-Agent': DEFAULT_USER_AGENT, Referer: 'https://www.bilibili.com/' }

export async function privateJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600, flag: 'wx' })
    await rename(temp, path)
  } finally {
    await rm(temp, { force: true })
  }
}

export async function request(url: string, init: RequestInit = {}, fetcher = fetch) {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`)
  return response
}

export function sessionValue(value: string): string {
  // Accept one raw SESSDATA value, never a whole cookie header or token pool.
  const token = value.trim()
  if (!token || /[\s;\r\n]/.test(token) || token.startsWith('SESSDATA=')) {
    throw new Error('INVALID_SESSION: provide only the SESSDATA cookie value')
  }
  return token
}

export async function readSession(authFile: string, env = process.env): Promise<string> {
  if (env.BILIBILI_SESSION_TOKEN) return sessionValue(env.BILIBILI_SESSION_TOKEN)
  try {
    const stored = JSON.parse(await readFile(authFile, 'utf8'))
    return sessionValue(stored.SESSDATA)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('AUTH_REQUIRED: run auth login or auth import')
    throw new Error('INVALID_AUTH_FILE: re-import SESSDATA or log in again')
  }
}

export async function checkSession(token: string, fetcher = fetch) {
  const response = await request('https://api.bilibili.com/x/web-interface/nav', {
    headers: { ...headers, Cookie: `SESSDATA=${sessionValue(token)}` },
  }, fetcher)
  const result = await response.json() as { code: number; data?: { isLogin?: boolean } }
  if (result.code !== 0 || result.data?.isLogin !== true) {
    throw new Error(`AUTH_INVALID: nav code ${result.code}; log in again`)
  }
  return { authenticated: true }
}

export async function importSession(input: string, authFile: string, fetcher = fetch) {
  const trimmed = input.trim()
  let token: string | undefined
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const json = JSON.parse(trimmed)
    const cookies = Array.isArray(json) ? json : json.cookies
    token = Array.isArray(cookies)
      ? cookies.find((c: { name: string; domain?: string }) => c.name === 'SESSDATA' &&
        (!c.domain || /(^|\.)bilibili\.com$/.test(c.domain)))?.value
      : json.SESSDATA
  } else if (trimmed.includes('\t')) {
    token = trimmed.split(/\r?\n/).map(line => line.replace(/^#HttpOnly_/, '').split('\t'))
      .find(parts => /(^|\.)bilibili\.com$/.test(parts[0] ?? '') && parts[5] === 'SESSDATA')?.[6]
  } else {
    token = /(?:^|;\s*)SESSDATA=([^;]+)/.exec(trimmed)?.[1] ?? trimmed
  }
  if (typeof token !== 'string') throw new Error('SESSDATA_NOT_FOUND')
  token = sessionValue(token)
  await checkSession(token, fetcher)
  await privateJson(authFile, { SESSDATA: token, savedAt: new Date().toISOString() })
  return { authenticated: true, authFile }
}

export async function startLogin(directory: string, fetcher = fetch) {
  const response = await request(`${passport}/generate`, { headers }, fetcher)
  const json = await response.json() as { code: number; data?: { url: string; qrcode_key: string } }
  if (json.code !== 0 || !json.data?.qrcode_key || !json.data.url) throw new Error('QR_GENERATE_FAILED')
  await mkdir(directory, { recursive: false, mode: 0o700 })
  const stateFile = join(directory, 'login.json')
  const qrFile = join(directory, 'login.png')
  // Never include the QR key or login URL in stdout/logs; render the local image.
  await privateJson(stateFile, { key: json.data.qrcode_key, createdAt: Date.now() })
  await writeFile(qrFile, await QRCode.toBuffer(json.data.url, { width: 360 }), { mode: 0o600 })
  await chmod(qrFile, 0o600)
  return { state: 'waiting_for_scan', stateFile, qrFile }
}

export async function pollLogin(stateFile: string, authFile: string, fetcher = fetch) {
  const state = JSON.parse(await readFile(stateFile, 'utf8'))
  if (typeof state.key !== 'string' || !Number.isFinite(state.createdAt)) throw new Error('INVALID_QR_STATE')
  if (Date.now() - state.createdAt > 180_000) throw new Error('QR_EXPIRED: run auth login again')
  const response = await request(`${passport}/poll?qrcode_key=${encodeURIComponent(state.key)}`, { headers }, fetcher)
  const json = await response.json() as { code: number; data?: { code: number } }
  if (json.code !== 0 || !json.data) throw new Error('QR_POLL_FAILED')
  if (json.data.code === 86101) return { state: 'waiting_for_scan' }
  if (json.data.code === 86090) return { state: 'waiting_for_confirmation' }
  if (json.data.code === 86038) throw new Error('QR_EXPIRED: run auth login again')
  if (json.data.code !== 0) throw new Error(`QR_UNKNOWN_STATE_${json.data.code}`)
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('SESSDATA='))
  const token = cookie?.split(';')[0]?.slice('SESSDATA='.length)
  if (!token) throw new Error('QR_NO_SESSION: successful response lacked SESSDATA')
  const result = await importSession(token, authFile, fetcher)
  await rm(stateFile, { force: true })
  await rm(join(dirname(stateFile), 'login.png'), { force: true })
  return { state: 'authenticated', ...result }
}
