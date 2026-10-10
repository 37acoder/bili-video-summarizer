/**
 * Missing-transcript handling.
 *
 * A video may have no usable transcript: the captions can be absent (the module
 * then falls back to the description), or the available text can be too thin to
 * summarize reliably. Feeding a one-line description to the chaptered-outline
 * prompt makes the model invent confident chapters — and `[00:00]` timestamps —
 * from the title alone.
 *
 * This module decides when that has happened and builds the deterministic,
 * clearly-labelled grounded fallback. No LLM call is made on that path, so the
 * model can never fabricate chapters or timestamps.
 */
import { resolveLanguageName } from '../prompt/language'
import type { SummarizeOptions, TranscriptResult } from '../types'
import { estimateTokens } from '../utils/tokens'

/** What to do when the transcript is missing or too thin. */
export type MissingTranscriptPolicy = 'degrade' | 'throw'

/**
 * Default minimum transcript size (estimated tokens) for a transcript to count
 * as usable. A one-line description is far below this; a real caption track of
 * more than a few seconds is comfortably above it.
 */
export const DEFAULT_MIN_TRANSCRIPT_TOKENS = 40

/** Leading note prepended to the grounded fallback, keyed by output language. */
export const MISSING_TRANSCRIPT_NOTICE = {
  zh: '⚠️ 未获取到字幕，以下仅依据标题与简介整理，可能不完整。',
  en: '⚠️ No captions were available. The following is based only on the title and description and may be incomplete.',
} as const

/**
 * Whether the transcript is missing or too thin to summarize reliably.
 *
 * A description-only transcript (`usedDescription`) is always treated as
 * missing. A captioned transcript is treated as missing when it is smaller than
 * `minTranscriptTokens`; pass `0` (or any non-positive value) to disable that
 * size check.
 */
export function isMissingTranscript(
  transcript: Pick<TranscriptResult, 'usedDescription' | 'transcriptText'>,
  minTranscriptTokens: number = DEFAULT_MIN_TRANSCRIPT_TOKENS,
): boolean {
  if (transcript.usedDescription) {
    return true
  }
  if (!(minTranscriptTokens > 0)) {
    return false
  }
  return estimateTokens(transcript.transcriptText) < minTranscriptTokens
}

function isChinese(languageName: string): boolean {
  return /chinese/i.test(languageName)
}

/**
 * Build the deterministic, explicitly-labelled grounded fallback for a missing
 * transcript. This is the final output — it is not sent to an LLM — so it only
 * ever restates the title and the available text (the description, or the thin
 * captions) and never contains fabricated chapters or timestamps.
 */
export function buildGroundedTranscriptSummary(
  transcript: Pick<TranscriptResult, 'title' | 'usedDescription' | 'transcriptText' | 'descriptionText'>,
  options: SummarizeOptions = {},
): string {
  const chinese = isChinese(resolveLanguageName(options.outputLanguage))
  const notice = chinese ? MISSING_TRANSCRIPT_NOTICE.zh : MISSING_TRANSCRIPT_NOTICE.en
  const title = transcript.title?.trim() ?? ''
  const body = (transcript.descriptionText?.trim() || transcript.transcriptText?.trim() || '').trim()
  const bodyLabel = transcript.usedDescription
    ? chinese
      ? '简介'
      : 'Description'
    : chinese
      ? '字幕'
      : 'Transcript'

  const sections: string[] = [notice]
  if (title) {
    sections.push(chinese ? `标题：${title}` : `Title: ${title}`)
  }
  if (body) {
    sections.push(`${bodyLabel}${chinese ? '：' : ': '}${body}`)
  }
  return sections.join('\n\n')
}
