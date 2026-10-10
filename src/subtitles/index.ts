/**
 * Subtitle extraction dispatcher.
 *
 * Ported from BibiGPT-v1 `lib/fetchSubtitle.ts` + the transcript assembly in
 * `lib/openai/buildSummarizeRequest.ts`.
 */
import type { ResolvedSubtitleConfig } from '../config'
import type { SummarizeInput, TranscriptResult } from '../types'
import { fetchBilibiliTranscript } from './bilibili'
import type { SubtitleFetchContext, SubtitleFetchResult } from './types'
import { fetchYoutubeTranscript } from './youtube'

export type { SubtitleFetchContext, SubtitleFetchResult } from './types'

/**
 * Fetch captions for the requested video and assemble the full transcript text
 * that will be fed to the map-reduce summarizer.
 */
export async function fetchTranscript(
  input: SummarizeInput,
  config: ResolvedSubtitleConfig,
  ctx: SubtitleFetchContext,
): Promise<TranscriptResult> {
  const { source, videoId, pageNumber } = input.video
  const shouldShowTimestamp = input.options?.showTimestamp

  const result: SubtitleFetchResult =
    source === 'youtube'
      ? await fetchYoutubeTranscript(videoId, shouldShowTimestamp, ctx)
      : await fetchBilibiliTranscript(videoId, pageNumber, shouldShowTimestamp, ctx)

  const { title, subtitlesArray, descriptionText } = result
  const usedDescription = !subtitlesArray || subtitlesArray.length === 0
  // The full transcript is carried forward (no random line dropping); the
  // map-reduce stage chunks it to fit the model's context window.
  const transcriptText = usedDescription
    ? (descriptionText ?? '')
    : subtitlesArray
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.text)
        .join(' ')

  return {
    title,
    videoId,
    source,
    subtitlesArray,
    descriptionText,
    transcriptText,
    usedDescription,
  }
}
