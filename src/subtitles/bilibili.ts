/**
 * Bilibili caption extraction.
 *
 * Ported from BibiGPT-v1 `lib/bilibili/fetchBilibiliSubtitle.ts` and
 * `lib/bilibili/fetchBilibiliSubtitleUrls.ts`. Uses Bilibili's own web APIs;
 * a logged-in SESSDATA cookie is required to read the caption list.
 */
import { find, sample } from '../utils/fp'
import { reduceBilibiliSubtitleTimestamp, type BilibiliSubtitleItem } from './reduce-subtitle-timestamp'
import type { SubtitleFetchContext, SubtitleFetchResult } from './types'

interface BilibiliSubtitleMeta {
  lan: string
  subtitle_url: string
}

interface BilibiliVideoInfo {
  title?: string
  desc?: string
  dynamic?: string
  pages?: Array<{ page: number; cid: number }>
  aid?: number
  subtitle?: { list: BilibiliSubtitleMeta[] }
}

async function fetchBilibiliSubtitleUrls(
  videoId: string,
  pageNumber: string | number | null | undefined,
  ctx: SubtitleFetchContext,
): Promise<BilibiliVideoInfo> {
  const sessdata = sample(ctx.config.bilibiliSessionTokens)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': ctx.config.userAgent,
    Host: 'api.bilibili.com',
    Cookie: `SESSDATA=${sessdata ?? ''}`,
  }
  const commonConfig: RequestInit = {
    method: 'GET',
    cache: 'no-cache',
    headers,
    referrerPolicy: 'no-referrer',
  }

  const params = videoId.startsWith('av') ? `?aid=${videoId.slice(2)}` : `?bvid=${videoId}`
  const requestUrl = `https://api.bilibili.com/x/web-interface/view${params}`
  ctx.logger.debug('fetch', requestUrl)
  const response = await ctx.fetch(requestUrl, commonConfig)
  const json = (await response.json()) as { data?: BilibiliVideoInfo }
  const data = json?.data

  // Support multi-part videos.
  if (pageNumber || (data?.pages?.length ?? 0) > 0) {
    const { aid, pages } = data ?? {}
    const matched = find(pages ?? [], { page: Number(pageNumber || 1) })
    const cid = matched?.cid

    const pageUrl = `https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}`
    const res = await ctx.fetch(pageUrl, commonConfig)
    const pageJson = (await res.json()) as { data?: { subtitle?: { subtitles: BilibiliSubtitleMeta[] } } }
    return { ...data, subtitle: { list: pageJson.data?.subtitle?.subtitles ?? [] } }
  }

  return data ?? {}
}

export async function fetchBilibiliTranscript(
  videoId: string,
  pageNumber: string | number | null | undefined,
  shouldShowTimestamp: boolean | undefined,
  ctx: SubtitleFetchContext,
): Promise<SubtitleFetchResult> {
  const res = await fetchBilibiliSubtitleUrls(videoId, pageNumber, ctx)
  const { title = '', desc, dynamic, subtitle } = res || {}
  const hasDescription = desc || dynamic
  const descriptionText = hasDescription ? `${desc} ${dynamic}` : undefined
  const subtitleList = subtitle?.list
  if (!subtitleList || subtitleList.length < 1) {
    return { title, subtitlesArray: null, descriptionText }
  }

  const betterSubtitle = subtitleList.find(({ lan }) => lan === 'zh-CN') || subtitleList[0]
  const rawUrl = betterSubtitle?.subtitle_url
  const subtitleUrl = rawUrl?.startsWith('//') ? `https:${rawUrl}` : rawUrl
  ctx.logger.debug('subtitle_url', subtitleUrl)

  if (!subtitleUrl) {
    return { title, subtitlesArray: null, descriptionText }
  }

  const subtitleResponse = await ctx.fetch(subtitleUrl)
  const subtitles = (await subtitleResponse.json()) as { body?: BilibiliSubtitleItem[] }
  const transcripts = reduceBilibiliSubtitleTimestamp(subtitles?.body, shouldShowTimestamp)
  return { title, subtitlesArray: transcripts, descriptionText }
}
