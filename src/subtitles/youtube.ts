/**
 * YouTube caption extraction.
 *
 * Ported from BibiGPT-v1 `lib/youtube/fetchYoutubeSubtitle.ts` and
 * `lib/youtube/fetchYoutubeSubtitleUrls.ts`. YouTube captions are downloaded
 * through the third-party savesubs.com API (an optional auth token may be
 * required).
 */
import { find } from '../utils/fp'
import { reduceYoutubeSubtitleTimestamp, type YoutubeSubtitleItem } from './reduce-subtitle-timestamp'
import type { SubtitleFetchContext, SubtitleFetchResult } from './types'

interface YoutubeSubtitleFormat {
  quality: string
  url: string
}

interface SavesubsExtractResponse {
  response?: {
    title?: string
    formats?: YoutubeSubtitleFormat[]
  }
}

async function fetchYoutubeSubtitleUrls(
  videoId: string,
  ctx: SubtitleFetchContext,
): Promise<{ title: string; subtitleList: YoutubeSubtitleFormat[] }> {
  const response = await ctx.fetch(`${ctx.config.savesubsBaseUrl}/action/extract`, {
    method: 'POST',
    body: JSON.stringify({
      data: { url: `https://www.youtube.com/watch?v=${videoId}` },
    }),
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent': ctx.config.userAgent,
      'X-Auth-Token': ctx.config.savesubsAuthToken ?? '',
      'X-Requested-Domain': 'savesubs.com',
      'X-Requested-With': 'xmlhttprequest',
    },
  })
  const { response: json = {} } = (await response.json()) as SavesubsExtractResponse
  return { title: json.title ?? '', subtitleList: json.formats ?? [] }
}

export async function fetchYoutubeTranscript(
  videoId: string,
  shouldShowTimestamp: boolean | undefined,
  ctx: SubtitleFetchContext,
): Promise<SubtitleFetchResult> {
  const { title, subtitleList } = await fetchYoutubeSubtitleUrls(videoId, ctx)
  if (!subtitleList || subtitleList.length <= 0) {
    return { title, subtitlesArray: null }
  }

  const betterSubtitle =
    find(subtitleList, { quality: 'zh-CN' }) ||
    find(subtitleList, { quality: 'English' }) ||
    find(subtitleList, { quality: 'English (auto' }) ||
    subtitleList[0]

  if (!betterSubtitle) {
    return { title, subtitlesArray: null }
  }

  if (shouldShowTimestamp) {
    const subtitleUrl = `${ctx.config.savesubsBaseUrl}${betterSubtitle.url}?ext=json`
    const response = await ctx.fetch(subtitleUrl)
    const subtitles = (await response.json()) as YoutubeSubtitleItem[]
    return { title, subtitlesArray: reduceYoutubeSubtitleTimestamp(subtitles) }
  }

  const subtitleUrl = `${ctx.config.savesubsBaseUrl}${betterSubtitle.url}?ext=txt`
  const response = await ctx.fetch(subtitleUrl)
  const subtitles = await response.text()
  const subtitlesArray = subtitles
    .split('\r\n\r\n')
    .filter((text) => text.trim().length > 0)
    .map((text, index) => ({ text, index }))
  return { title, subtitlesArray }
}
