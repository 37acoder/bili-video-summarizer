/**
 * Prompt construction.
 *
 * The default output is a **chaptered outline** (one-sentence summary, ordered
 * chapters with timestamps and 1-3 key points each, then key takeaways) whose
 * chapter count adapts to the video length. The original BibiGPT bullet
 * templates are kept and can be selected with `summaryFormat: 'bullets'`.
 *
 * On top of the single-pass prompt this module adds the map-reduce pair:
 * `buildMapPrompt` summarizes one transcript segment, and `buildReducePrompt`
 * merges a segment summary into the accumulated summary while re-reading the
 * raw subtitles around the segment seam.
 */
import { DEFAULT_MODEL } from '../llm/model-context'
import { limitTranscriptByteLength } from '../transcript/small-size-transcripts'
import type { SummarizeOptions } from '../types'
import { estimateTokens } from '../utils/tokens'
import { resolveLanguageName } from './language'

export { DEFAULT_MODEL }

export interface PromptInput {
  title: string
  transcript: string
  options?: SummarizeOptions
  /**
   * Byte budget applied to the transcript before it is embedded. When omitted
   * (or non-positive) the transcript is embedded in full — the map-reduce path
   * relies on chunking for bounding, not on byte truncation.
   */
  transcriptByteLimit?: number
  /** Video duration in seconds, when known; drives the adaptive outline length. */
  durationSeconds?: number
}

/** Lower/upper bounds for the adaptive chapter count. */
export const MIN_OUTLINE_SECTIONS = 1
export const MAX_OUTLINE_SECTIONS = 12
/** Seconds of video per chapter when the duration is known. */
export const SECONDS_PER_SECTION = 120
/** Transcript tokens per chapter when the duration is unknown. */
export const TOKENS_PER_SECTION = 1200
/** Output-token headroom reserved per chapter for the chaptered outline. */
export const OUTLINE_TOKENS_PER_SECTION = 320

/** Minimum words per bullet point, derived from `detailLevel` (UI range 300-1000). */
function wordsPerBullet(detailLevel?: number): number {
  return detailLevel ? (Number(detailLevel) / 100) * 2 : 15
}

function limitIfRequested(text: string, byteLimit?: number): string {
  return typeof byteLimit === 'number' && byteLimit > 0 ? limitTranscriptByteLength(text, byteLimit) : text
}

function clean(text: string | undefined): string {
  return text?.replace(/\n+/g, ' ').trim() ?? ''
}

function clampSections(count: number): number {
  return Math.min(MAX_OUTLINE_SECTIONS, Math.max(MIN_OUTLINE_SECTIONS, count))
}

/**
 * Adaptive chapter count: derived from the video duration (~1 chapter per two
 * minutes) or, when the duration is unknown, from the transcript size. An
 * explicit `sentenceNumber` overrides the estimate.
 */
export function resolveTargetSections({
  transcript,
  durationSeconds,
  explicit,
}: {
  transcript: string
  durationSeconds?: number
  explicit?: number
}): number {
  const explicitCount = Number(explicit)
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return clampSections(Math.round(explicitCount))
  }
  const byDuration = durationSeconds && durationSeconds > 0 ? Math.ceil(durationSeconds / SECONDS_PER_SECTION) : 0
  const byTokens = Math.ceil(estimateTokens(transcript) / TOKENS_PER_SECTION)
  return clampSections(Math.max(byDuration, byTokens))
}

function isChinese(languageName: string): boolean {
  return /chinese/i.test(languageName)
}

/** The final bullet-point instruction body for the plain (non-timestamp) template. */
function subtitleInstructionBody(options: SummarizeOptions = {}): string {
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
  return `Your output should use the following template:\n## Summary\n## Highlights\n- ${emojiTemplateText}Bulletpoint${outlineTemplateText}\n\nYour task is to summarise the text I have given you in up to ${sentenceCount} concise bullet points, starting with a short highlight, each bullet point is at least ${wordsCount} words. ${outlineDescriptionText}${emojiDescriptionText}Use the text above: {{Title}} {{Transcript}}.\n\nReply in ${languageName} Language.`
}

/** The final bullet-point instruction body for the timestamp template. */
function timestampInstructionBody(options: SummarizeOptions = {}): string {
  const languageName = resolveLanguageName(options.outputLanguage)
  const sentenceCount = options.sentenceNumber ?? 7
  const emojiTemplateText = options.showEmoji ? '[Emoji] ' : ''
  const wordsCount = wordsPerBullet(options.detailLevel)
  return `Act as the author and provide exactly ${sentenceCount} bullet points for the text transcript given in the format [seconds] - [text] \nMake sure that:\n    - Please start by summarizing the whole video in one short sentence\n    - Then, please summarize with each bullet_point is at least ${wordsCount} words\n    - each bullet_point start with "- " or a number or a bullet point symbol\n    - each bullet_point should has the start timestamp, use this template: - seconds - ${emojiTemplateText}[bullet_point]\n    - there may be typos in the subtitles, please correct them\n    - Reply all in ${languageName} Language.`
}

/** The chaptered-outline instruction body (the default output format). */
function outlineInstructionBody(options: SummarizeOptions, targetSections: number, languageName: string): string {
  const headers = isChinese(languageName)
    ? { summary: '## 一句话总结', chapters: '## 章节要点', takeaways: '## 关键结论' }
    : { summary: '## Summary', chapters: '## Chapters', takeaways: '## Key Takeaways' }
  const timestampHint = options.showTimestamp
    ? ' Start every chapter heading with its start timestamp, e.g. `### [12:34] 章节标题`.'
    : ''
  return [
    'Your output must be a chaptered outline using exactly this structure:',
    headers.summary,
    '<one sentence summarising the whole video>',
    headers.chapters,
    '### [mm:ss] <chapter title>',
    '- <1-3 key points; keep the names, numbers and conclusions>',
    headers.takeaways,
    '- <2-4 key conclusions or actionable ideas>',
    '',
    `Produce exactly ${targetSections} chapters in chronological order, covering the ENTIRE transcript from beginning to end.${timestampHint} Do not skip the middle or the end, and avoid generic filler. There may be typos in the subtitles, please correct them.`,
    '',
    `Reply in ${languageName} Language.`,
  ].join('\n')
}

/** Instruction body for the configured summary format. */
function finalInstructionBody(options: SummarizeOptions = {}, targetSections?: number): string {
  if ((options.summaryFormat ?? 'outline') === 'bullets') {
    return options.showTimestamp ? timestampInstructionBody(options) : subtitleInstructionBody(options)
  }
  return outlineInstructionBody(
    options,
    targetSections ?? MIN_OUTLINE_SECTIONS,
    resolveLanguageName(options.outputLanguage),
  )
}

export function getUserSubtitlePrompt({ title, transcript, options = {}, transcriptByteLimit }: PromptInput): string {
  const videoTitle = clean(title)
  const videoTranscript = clean(limitIfRequested(transcript, transcriptByteLimit))
  return `Title: "${videoTitle}"\nTranscript: "${videoTranscript}"\n\nInstructions: ${subtitleInstructionBody(options)}`
}

export function getUserSubtitleWithTimestampPrompt({
  title,
  transcript,
  options = {},
  transcriptByteLimit,
}: PromptInput): string {
  const videoTitle = clean(title)
  const videoTranscript = clean(limitIfRequested(transcript, transcriptByteLimit))
  const videoTranscripts = limitIfRequested(JSON.stringify(videoTranscript), transcriptByteLimit)
  return `Title: ${videoTitle}\nTranscript: ${videoTranscripts}\n\nInstructions: ${timestampInstructionBody(options)}`
}

/** Chaptered-outline prompt for the whole transcript (the default format). */
export function buildOutlinePrompt({
  title,
  transcript,
  options = {},
  transcriptByteLimit,
  durationSeconds,
}: PromptInput): string {
  const videoTitle = clean(title)
  const videoTranscript = clean(limitIfRequested(transcript, transcriptByteLimit))
  const languageName = resolveLanguageName(options.outputLanguage)
  const targetSections = resolveTargetSections({
    transcript: videoTranscript,
    durationSeconds,
    explicit: options.sentenceNumber,
  })
  return `Title: "${videoTitle}"\nTranscript: "${videoTranscript}"\n\nInstructions: ${outlineInstructionBody(options, targetSections, languageName)}`
}

/**
 * Build the final user prompt. Defaults to the chaptered outline; pass
 * `options.summaryFormat = 'bullets'` for the original BibiGPT template.
 */
export function buildUserPrompt(input: PromptInput): string {
  if ((input.options?.summaryFormat ?? 'outline') === 'bullets') {
    return input.options?.showTimestamp
      ? getUserSubtitleWithTimestampPrompt(input)
      : getUserSubtitlePrompt(input)
  }
  return buildOutlinePrompt(input)
}

export interface MapPromptInput {
  title: string
  /** The transcript text of a single segment. */
  segmentText: string
  /** Zero-based position of the segment. */
  segmentIndex: number
  segmentCount: number
  options?: SummarizeOptions
}

/**
 * Prompt for one map call: summarize a single segment of a longer transcript in
 * detail, deliberately without the final report format (the reduce step
 * produces that).
 */
export function buildMapPrompt({
  title,
  segmentText,
  segmentIndex,
  segmentCount,
  options = {},
}: MapPromptInput): string {
  const videoTitle = clean(title)
  const languageName = resolveLanguageName(options.outputLanguage)
  const timestampHint = options.showTimestamp
    ? ' Keep the start timestamps (in seconds) attached to the details you keep.'
    : ''
  return [
    `Title: "${videoTitle}"`,
    `Segment: ${segmentIndex + 1}/${segmentCount}`,
    `Transcript segment: "${clean(segmentText)}"`,
    '',
    `Instructions: This is one segment of a longer video transcript. Summarize this segment in detail, preserving the key facts, names, numbers, arguments and examples.${timestampHint} Do not produce the final report; a later step merges every segment. There may be typos in the subtitles, please correct them. Reply in ${languageName} Language.`,
  ].join('\n')
}

export interface ReducePromptInput {
  title: string
  /** The summary accumulated from all previous segments. */
  priorSummary: string
  /** The summary of the segment about to be merged in. */
  segmentSummary: string
  /** Raw subtitles straddling the seam between the two segments. */
  seamSubtitle?: string
  /** Adaptive chapter count for the merged output. */
  targetSections?: number
  options?: SummarizeOptions
}

/**
 * Prompt for one reduce step: merge the new segment summary into the
 * accumulated summary, using the raw subtitles around the seam to preserve
 * section transitions, and emit the final report format.
 */
export function buildReducePrompt({
  title,
  priorSummary,
  segmentSummary,
  seamSubtitle,
  targetSections,
  options = {},
}: ReducePromptInput): string {
  const videoTitle = clean(title)
  const seam = clean(seamSubtitle)
  const lines = [
    `Title: "${videoTitle}"`,
    '',
    '已累积的上文小结:',
    priorSummary.trim() || '(无，这是第一段)',
    '',
    '本段小结:',
    segmentSummary.trim(),
  ]
  if (seam) {
    lines.push('', '交界处原始字幕（用于衔接，避免段落过渡信息丢失）:', seam)
  }
  lines.push(
    '',
    `Instructions: ${finalInstructionBody(options, targetSections)} Merge the new segment into the accumulated summary, using the seam subtitles for continuity, and output the updated complete summary in the required format.`,
  )
  return lines.join('\n')
}

/** Faithful port of BibiGPT's `max_tokens` rule: `detailLevel || (userKey ? 800 : 600)`. */
export function resolveMaxOutputTokens(options: SummarizeOptions = {}, hasUserKey = false): number {
  if (options.maxOutputTokens !== undefined) {
    return options.maxOutputTokens
  }
  return Number(options.detailLevel) || (hasUserKey ? 800 : 600)
}
