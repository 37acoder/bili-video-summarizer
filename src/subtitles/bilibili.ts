/**
 * Bilibili caption extraction.
 *
 * Ported from BibiGPT-v1 `lib/bilibili/fetchBilibiliSubtitle.ts` and
 * `lib/bilibili/fetchBilibiliSubtitleUrls.ts`. Uses Bilibili's own web APIs;
 * a logged-in SESSDATA cookie is required to read the caption list.
 *
 * Deviation from upstream (documented in README): Bilibili's `x/player/v2`
 * intermittently returns a degraded subtitle list whose `ai-zh` URL points to
 * an unrelated video's caption file. This port therefore validates each
 * downloaded caption file against the video duration and retries a few times
 * before accepting, instead of trusting the first response.
 */
import { find, sample } from '../utils/fp'
import { reduceBilibiliSubtitleTimestamp, type BilibiliSubtitleItem } from './reduce-subtitle-timestamp'
import type { SubtitleFetchContext, SubtitleFetchResult } from './types'
import { SummarizeError } from '../errors'

interface BilibiliSubtitleMeta {
  lan: string
  subtitle_url: string
}

interface BilibiliPage {
  page: number
  cid: number
  duration?: number
}

interface BilibiliViewInfo {
  title?: string
  desc?: string
  dynamic?: string
  aid?: number
  duration?: number
  pages?: BilibiliPage[]
}

interface BilibiliSubtitleFile {
  body?: BilibiliSubtitleItem[]
}

/** How many times to re-fetch the caption list when a file looks wrong. */
export const MAX_SUBTITLE_ATTEMPTS = 8

function bilibiliHeaders(ctx: SubtitleFetchContext, videoId: string): Record<string, string> {
  const sessdata = sample(ctx.config.bilibiliSessionTokens)
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': ctx.config.userAgent,
    Host: 'api.bilibili.com',
    Cookie: `SESSDATA=${sessdata ?? ''}`,
    Referer: `https://www.bilibili.com/video/${videoId}/`,
  }
}

function commonConfig(headers: Record<string, string>): RequestInit {
  return {
    method: 'GET',
    cache: 'no-cache',
    headers,
    referrerPolicy: 'no-referrer',
  }
}

async function fetchViewInfo(videoId: string, ctx: SubtitleFetchContext): Promise<BilibiliViewInfo> {
  const params = videoId.startsWith('av') ? `?aid=${videoId.slice(2)}` : `?bvid=${videoId}`
  const requestUrl = `https://api.bilibili.com/x/web-interface/view${params}`
  ctx.logger.debug('fetch', requestUrl)
  const response = await ctx.fetch(requestUrl, commonConfig(bilibiliHeaders(ctx, videoId)))
  if (!response.ok) throw new SummarizeError(response.status, 'UPSTREAM', `Bilibili HTTP ${response.status}`)
  const json = (await response.json()) as { code?: number; data?: BilibiliViewInfo }
  if (json.code !== 0) throw new SummarizeError(502, 'UPSTREAM', `Bilibili view code ${json.code}`)
  if (!json.data || typeof json.data !== 'object') throw new SummarizeError(502, 'CAPTIONS_INVALID', 'Invalid Bilibili view response')
  return json.data
}

async function fetchSubtitleList(
  aid: number | undefined,
  cid: number | undefined,
  videoId: string,
  ctx: SubtitleFetchContext,
): Promise<BilibiliSubtitleMeta[]> {
  const requestUrl = `https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}`
  ctx.logger.debug('fetch', requestUrl)
  const response = await ctx.fetch(requestUrl, commonConfig(bilibiliHeaders(ctx, videoId)))
  if (!response.ok) throw new SummarizeError(response.status, 'UPSTREAM', `Bilibili HTTP ${response.status}`)
  const json = (await response.json()) as { code?: number; data?: { subtitle?: { subtitles?: BilibiliSubtitleMeta[] } } }
  if (json.code !== 0) throw new SummarizeError(502, 'UPSTREAM', `Bilibili player code ${json.code}`)
  const list = json?.data?.subtitle?.subtitles
  if (!Array.isArray(list)) throw new SummarizeError(502, 'CAPTIONS_INVALID', 'Invalid Bilibili caption list')
  return list
}

function pickSubtitle(list: BilibiliSubtitleMeta[]): BilibiliSubtitleMeta | undefined {
  return list.find(({ lan }) => lan === 'zh-CN') || list[0]
}

function normalizeSubtitleUrl(url: string | undefined): string | undefined {
  return url?.startsWith('//') ? `https:${url}` : url
}

export async function fetchBilibiliTranscript(
  videoId: string,
  pageNumber: string | number | null | undefined,
  shouldShowTimestamp: boolean | undefined,
  ctx: SubtitleFetchContext,
): Promise<SubtitleFetchResult> {
  const data = await fetchViewInfo(videoId, ctx)
  const { title = '', desc, dynamic, aid, pages } = data
  const descriptionText = desc || dynamic ? `${desc ?? ''} ${dynamic ?? ''}`.trim() : undefined

  // Videos without pages keep the original behavior: no caption list to fetch.
  const hasPages = (pages?.length ?? 0) > 0
  if (!hasPages && !pageNumber) {
    return { title, subtitlesArray: null, descriptionText, captionStatus: 'unusable' }
  }

  const matchedPage = hasPages ? find(pages ?? [], { page: Number(pageNumber || 1) }) : undefined
  if (pageNumber != null && !matchedPage) throw new SummarizeError(400, 'UPSTREAM', 'Bilibili page does not exist')
  const cid = matchedPage?.cid ?? pages?.[0]?.cid
  if (!aid || !cid) {
    return { title, subtitlesArray: null, descriptionText, captionStatus: 'unusable' }
  }
  const duration = matchedPage?.duration ?? data.duration
  const media = { cid, durationSeconds: duration, pageNumber: Number(pageNumber || 1) }
  let sawCaption = false

  for (let attempt = 1; attempt <= MAX_SUBTITLE_ATTEMPTS; attempt++) {
    const subtitleList = await fetchSubtitleList(aid, cid, videoId, ctx)
    if (!subtitleList || subtitleList.length < 1) {
      ctx.logger.debug(`empty subtitle list for ${videoId} (attempt ${attempt})`)
      if (!sawCaption) return { title, subtitlesArray: null, descriptionText, captionStatus: 'absent', media }
      continue
    }
    sawCaption = true

    const betterSubtitle = pickSubtitle(subtitleList)
    const subtitleUrl = normalizeSubtitleUrl(betterSubtitle?.subtitle_url)
    if (!subtitleUrl) {
      continue
    }

    const subtitleResponse = await ctx.fetch(subtitleUrl, {
      headers: {
        'User-Agent': ctx.config.userAgent,
        Referer: `https://www.bilibili.com/video/${videoId}/`,
      },
    })
    // Transport and JSON failures retain their identity; only unusable caption
    // content may participate in the bounded validation retry path.
    if (!subtitleResponse.ok) throw new SummarizeError(subtitleResponse.status, 'UPSTREAM', `Bilibili captions HTTP ${subtitleResponse.status}`)
    const subtitles = (await subtitleResponse.json()) as BilibiliSubtitleFile
    const body = subtitles?.body
    if (!Array.isArray(body) || body.length === 0 || body.some(item => typeof item.content !== 'string' || !Number.isFinite(item.from) || item.from < 0)) {
      continue
    }

    const lastFrom = Number(body[body.length - 1]?.from ?? 0)
    const tolerance = Math.max(15, (duration ?? 0) * 0.03)
    const matchesDuration = duration == null || Math.abs(lastFrom - duration) <= tolerance
    const subtitlesArray = reduceBilibiliSubtitleTimestamp(body, shouldShowTimestamp)

    if (matchesDuration) {
      return { title, subtitlesArray, descriptionText, captionStatus: 'available', media }
    }

    ctx.logger.warn(
      `bilibili subtitle for ${videoId} looks wrong (ends at ${lastFrom}s, video is ${duration}s); ` +
        `retry ${attempt}/${MAX_SUBTITLE_ATTEMPTS}`,
    )
  }

  // Never fall back to an unvalidated subtitle file: when the duration is
  // known and nothing matched, a mismatched file belongs to another video and
  // would silently produce a summary of the wrong content. Degrade to the
  // description instead.
  ctx.logger.warn(`no duration-matched subtitle for ${videoId} after ${MAX_SUBTITLE_ATTEMPTS} attempts`)
  return { title, subtitlesArray: null, descriptionText, captionStatus: sawCaption ? 'unusable' : 'absent', media }
}
