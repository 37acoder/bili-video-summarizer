/**
 * video-summarizer
 *
 * A framework-agnostic module that summarizes YouTube/Bilibili videos by
 * extracting captions and prompting an OpenAI-compatible LLM.
 *
 * Extracted from BibiGPT-v1 (https://github.com/JimmyLv/BibiGPT), MIT licensed.
 */
export { createVideoSummarizer } from './summarizer'
export type { VideoSummarizer, VideoSummarizerOptions } from './summarizer'

// Caption extraction
export { fetchTranscript } from './subtitles'
export { fetchYoutubeTranscript } from './subtitles/youtube'
export { fetchBilibiliTranscript } from './subtitles/bilibili'
export {
  reduceSubtitleTimestamp,
  reduceYoutubeSubtitleTimestamp,
  reduceBilibiliSubtitleTimestamp,
} from './subtitles/reduce-subtitle-timestamp'
export type { SubtitleFetchContext, SubtitleFetchResult } from './subtitles/types'

// Transcript sizing
export {
  getSmallSizeTranscripts,
  limitTranscriptByteLength,
  getByteLength,
  DEFAULT_TRANSCRIPT_BYTE_LIMIT,
} from './transcript/small-size-transcripts'

// Prompt building
export {
  buildUserPrompt,
  getUserSubtitlePrompt,
  getUserSubtitleWithTimestampPrompt,
  resolveMaxOutputTokens,
  DEFAULT_MODEL,
} from './prompt/prompt'
export {
  LANGUAGE_CODE_TO_ENGLISH_NAME,
  PROMPT_LANGUAGE_MAP,
  DEFAULT_LANGUAGE,
  resolveLanguageName,
} from './prompt/language'

// LLM client
export {
  createOpenAICompatibleClient,
  normalizeBaseUrl,
  resolveApiKey,
  trimResult,
} from './llm/openai-compatible'

// Cache
export { getCacheId, createMemoryCache } from './cache'

// Config
export {
  resolveSubtitleConfig,
  DEFAULT_USER_AGENT,
  DEFAULT_SAVESUBS_BASE_URL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
} from './config'
export type { LlmConfig, SubtitleConfig, ResolvedSubtitleConfig } from './config'

// Utilities
export { sample, find, toStringArray } from './utils/fp'
export { noopLogger, consoleLogger } from './utils/logger'
export { SummarizeError, isSummarizeError } from './errors'
export type { SummarizeErrorCode } from './errors'

// Types
export type {
  VideoSource,
  VideoRequest,
  SummarizeOptions,
  SummarizeInput,
  CommonSubtitleItem,
  TranscriptResult,
  ChatRole,
  ChatMessage,
  BuiltPrompt,
  GenerateParams,
  LlmClient,
  CacheStore,
  Logger,
  FetchLike,
} from './types'
