/**
 * Public types for the video-summarizer module.
 *
 * The names intentionally mirror BibiGPT-v1 (`VideoConfig` / `UserConfig`) so
 * that the original code stays recognizable, but the shape is flattened and
 * cleaned up for reuse outside of Next.js.
 */

export type VideoSource = 'youtube' | 'bilibili'

/** Identifies which video to summarize. */
export interface VideoRequest {
  source: VideoSource
  /** YouTube video id, or Bilibili `bvid`/`av` id. */
  videoId: string
  /** Bilibili multi-part page number (1-based). */
  pageNumber?: string | number | null
}

/** Per-request summarization options (maps to BibiGPT's `VideoConfig` schema). */
export interface SummarizeOptions {
  /** Model id, e.g. `gpt-3.5-turbo`. Falls back to the configured default. */
  model?: string
  /** Output language: a locale code (`zh-CN`) or an English language name. */
  outputLanguage?: string
  /**
   * Detail level (BibiGPT UI: 300-1000). Used as `max_tokens` and to derive the
   * minimum words per bullet point.
   */
  detailLevel?: number
  /** Maximum number of bullet points the model should produce (UI: 3-10). */
  sentenceNumber?: number
  /** Outline hierarchy depth; > 1 enables nested child bullets (UI: 1-5). */
  outlineLevel?: number
  /** Ask the model to prefix each bullet with its start timestamp. */
  showTimestamp?: boolean
  /** Ask the model to pick an emoji per bullet. */
  showEmoji?: boolean
  /** Whether the caller intends to consume a stream (informational). */
  enableStream?: boolean
  /** Explicit override for the max output tokens. */
  maxOutputTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  /** Abort signal forwarded to the LLM call. */
  signal?: AbortSignal
}

/** Input accepted by `VideoSummarizer.summarize` / `.summarizeStream`. */
export interface SummarizeInput {
  video: VideoRequest
  options?: SummarizeOptions
}

/** One reduced subtitle line (a group of original caption lines). */
export interface CommonSubtitleItem {
  text: string
  index: number
  /** Start time in seconds. */
  s?: number | string
}

/** Result of the caption-extraction stage. */
export interface TranscriptResult {
  title: string
  videoId: string
  source: VideoSource
  /** Reduced subtitle items, or `null` when the video has no captions. */
  subtitlesArray: CommonSubtitleItem[] | null
  /** Video description, used as a fallback when there are no captions. */
  descriptionText?: string
  /** Final text fed to the LLM (already size-limited). */
  transcriptText: string
  /** Whether the description fallback was used instead of captions. */
  usedDescription: boolean
}

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/** Fully-resolved payload ready to hand to an LLM client. */
export interface BuiltPrompt {
  videoId: string
  source: VideoSource
  title: string
  model: string
  messages: ChatMessage[]
  /** Convenience alias for `messages[0].content` when a single user message is used. */
  prompt: string
  maxOutputTokens: number
}

/** Parameters passed to an `LlmClient`. */
export interface GenerateParams {
  model: string
  messages: ChatMessage[]
  maxOutputTokens: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  signal?: AbortSignal
}

/**
 * Pluggable LLM boundary. Provide your own implementation to use a different
 * provider, to add instrumentation, or to inject a stub in tests.
 */
export interface LlmClient {
  generate(params: GenerateParams): Promise<string>
  stream(params: GenerateParams): Promise<AsyncIterable<string>>
}

/** Pluggable cache boundary (e.g. Redis, KV, in-memory). */
export interface CacheStore {
  get(key: string): Promise<string | null | undefined>
  set(key: string, value: string): Promise<unknown>
}

export interface Logger {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

/** `fetch`-compatible function, injectable for testing or alternative runtimes. */
export type FetchLike = typeof fetch
