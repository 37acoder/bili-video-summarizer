import { fetchTranscript } from '../subtitles'
import type { ResolvedSubtitleConfig } from '../config'
import type { SubtitleFetchContext } from '../subtitles/types'
import type { SummarizeInput } from '../types'
import type { LocalTranscriptionOptions } from './types'
import { SummarizeError } from '../errors'

export async function fetchTranscriptWithLocal(input: SummarizeInput, config: ResolvedSubtitleConfig, ctx: SubtitleFetchContext, local?: LocalTranscriptionOptions | false) {
  // One session throughout caption lookup, login validation and audio download.
  if (local && input.video.source === 'bilibili') {
    config = { ...config, bilibiliSessionTokens: config.bilibiliSessionTokens.slice(0, 1) }
    ctx = { ...ctx, config }
  }
  const transcript = await fetchTranscript(input, config, ctx)
  if (!local) return transcript
  if (transcript.captionStatus === 'unusable') throw new SummarizeError(502, 'CAPTIONS_INVALID', 'Platform captions are invalid; local transcription was not started')
  if (transcript.captionStatus !== 'absent') return transcript
  if (input.video.source === 'bilibili') {
    const token = config.bilibiliSessionTokens[0]
    if (!token) throw new SummarizeError(401, 'UPSTREAM', 'Bilibili authentication is required to confirm caption absence')
    const response = await ctx.fetch('https://api.bilibili.com/x/web-interface/nav', { headers: { 'User-Agent': config.userAgent, Cookie: `SESSDATA=${token}` }, signal: input.options?.signal })
    if (!response.ok) throw new SummarizeError(response.status, 'UPSTREAM', `Bilibili authentication HTTP ${response.status}`)
    const nav = await response.json() as { code?: number; data?: { isLogin?: boolean } }
    if (nav.code !== 0 || nav.data?.isLogin !== true) throw new SummarizeError(401, 'UPSTREAM', 'Bilibili session is invalid; local transcription was not started')
  }
  return (await import('./local')).transcribeLocally(input, transcript, config, local)
}
