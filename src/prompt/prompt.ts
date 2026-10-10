/**
 * Prompt construction.
 *
 * Ported from BibiGPT-v1 `lib/openai/prompt.ts` (`getUserSubtitlePrompt` and
 * `getUserSubtitleWithTimestampPrompt`). The prompt template, word-count
 * formula and outline/emoji switches are kept identical to the original.
 */
import { limitTranscriptByteLength } from '../transcript/small-size-transcripts'
import type { SummarizeOptions } from '../types'
import { resolveLanguageName } from './language'

export interface PromptInput {
  title: string
  transcript: string
  options?: SummarizeOptions
  /** Byte budget applied to the transcript before it is embedded. */
  transcriptByteLimit?: number
}

/** Minimum words per bullet point, derived from `detailLevel` (UI range 300-1000). */
function wordsPerBullet(detailLevel?: number): number {
  return detailLevel ? (Number(detailLevel) / 100) * 2 : 15
}

export function getUserSubtitlePrompt({ title, transcript, options = {}, transcriptByteLimit }: PromptInput): string {
  const videoTitle = title?.replace(/\n+/g, ' ').trim()
  const videoTranscript = limitTranscriptByteLength(transcript, transcriptByteLimit).replace(/\n+/g, ' ').trim()
  const languageName = resolveLanguageName(options.outputLanguage)
  const sentenceCount = options.sentenceNumber ?? 7
  const emojiTemplateText = options.showEmoji ? '[Emoji] ' : ''
  const emojiDescriptionText = options.showEmoji ? 'Choose an appropriate emoji for each bullet point. ' : ''
  const shouldShowAsOutline = Number(options.outlineLevel) > 1
  const wordsCount = wordsPerBullet(options.detailLevel)
  const outlineTemplateText = shouldShowAsOutline ? `\n    - Child points` : ''
  const outlineDescriptionText = shouldShowAsOutline
    ? `Use the outline list, which can have a hierarchical structure of up to ${options.outlineLevel} levels. `
    : ''
  const prompt = `Your output should use the following template:\n## Summary\n## Highlights\n- ${emojiTemplateText}Bulletpoint${outlineTemplateText}\n\nYour task is to summarise the text I have given you in up to ${sentenceCount} concise bullet points, starting with a short highlight, each bullet point is at least ${wordsCount} words. ${outlineDescriptionText}${emojiDescriptionText}Use the text above: {{Title}} {{Transcript}}.\n\nReply in ${languageName} Language.`

  return `Title: "${videoTitle}"\nTranscript: "${videoTranscript}"\n\nInstructions: ${prompt}`
}

export function getUserSubtitleWithTimestampPrompt({
  title,
  transcript,
  options = {},
  transcriptByteLimit,
}: PromptInput): string {
  const videoTitle = title?.replace(/\n+/g, ' ').trim()
  const videoTranscript = limitTranscriptByteLength(transcript, transcriptByteLimit).replace(/\n+/g, ' ').trim()
  const languageName = resolveLanguageName(options.outputLanguage)
  const sentenceCount = options.sentenceNumber ?? 7
  const emojiTemplateText = options.showEmoji ? '[Emoji] ' : ''
  const wordsCount = wordsPerBullet(options.detailLevel)
  const promptWithTimestamp = `Act as the author and provide exactly ${sentenceCount} bullet points for the text transcript given in the format [seconds] - [text] \nMake sure that:\n    - Please start by summarizing the whole video in one short sentence\n    - Then, please summarize with each bullet_point is at least ${wordsCount} words\n    - each bullet_point start with "- " or a number or a bullet point symbol\n    - each bullet_point should has the start timestamp, use this template: - seconds - ${emojiTemplateText}[bullet_point]\n    - there may be typos in the subtitles, please correct them\n    - Reply all in ${languageName} Language.`
  const videoTranscripts = limitTranscriptByteLength(JSON.stringify(videoTranscript), transcriptByteLimit)
  return `Title: ${videoTitle}\nTranscript: ${videoTranscripts}\n\nInstructions: ${promptWithTimestamp}`
}

/** Build the user prompt, choosing the timestamp variant when requested. */
export function buildUserPrompt(input: PromptInput): string {
  return input.options?.showTimestamp
    ? getUserSubtitleWithTimestampPrompt(input)
    : getUserSubtitlePrompt(input)
}

/** Default model when none is configured. */
export const DEFAULT_MODEL = 'gpt-3.5-turbo'

/** Faithful port of BibiGPT's `max_tokens` rule: `detailLevel || (userKey ? 800 : 600)`. */
export function resolveMaxOutputTokens(options: SummarizeOptions = {}, hasUserKey = false): number {
  if (options.maxOutputTokens !== undefined) {
    return options.maxOutputTokens
  }
  return Number(options.detailLevel) || (hasUserKey ? 800 : 600)
}
