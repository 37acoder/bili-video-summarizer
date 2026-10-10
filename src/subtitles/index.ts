/**
 * Subtitle extraction dispatcher.
 *
 * Ported from BibiGPT-v1 `lib/fetchSubtitle.ts` + the transcript assembly in
 * `lib/openai/buildSummarizeRequest.ts`.
 */
import type { ResolvedSubtitleConfig } from '../config'
import { getSmallSizeTranscripts } from '../transcript/small-size-transcripts'
import type { SummarizeInput, TranscriptResult } from '../types'
import { fetchBilibiliTranscript } from './bilibili'
import type { SubtitleFetchContext, SubtitleFetchResult } from './types'
import { fetchYoutubeTranscript } from './youtube'

export type { SubtitleFetchContext, SubtitleFetchResult } from './types'

/**
 * Fetch captions for the requested video and assemble the final transcript text
 * (size-limited) that will be embedded in the prompt.
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
  const transcriptText = usedDescription
    ? (descriptionText ?? '')
    : getSmallSizeTranscripts(subtitlesArray, subtitlesArray, config.transcriptByteLimit)

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
