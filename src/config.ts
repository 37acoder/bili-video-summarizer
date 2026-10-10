import { DEFAULT_TRANSCRIPT_BYTE_LIMIT } from './transcript/small-size-transcripts'
import { readEnv } from './utils/env'
import { toStringArray } from './utils/fp'

/** Configuration for the default OpenAI-compatible LLM client. */
export interface LlmConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  providerName?: string
  /**
   * Default provider reasoning/thinking effort. Forwarded as `reasoning_effort`.
   * Set to `none` for DeepSeek-style reasoning models used for summarization.
   */
  reasoningEffort?: string
}

/** Configuration for subtitle extraction. */
export interface SubtitleConfig {
  /** Base URL of the savesubs.com service used for YouTube captions. */
  savesubsBaseUrl?: string
  /** Optional savesubs auth token. */
  savesubsAuthToken?: string
  /** Bilibili SESSDATA cookie value(s); multiple values are rotated randomly. */
  bilibiliSessionTokens?: string | string[]
  userAgent?: string
  /** Byte budget for the transcript embedded in the prompt. */
  transcriptByteLimit?: number
}

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'

export const DEFAULT_SAVESUBS_BASE_URL = 'https://savesubs.com'
export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1'

export interface ResolvedSubtitleConfig {
  savesubsBaseUrl: string
  savesubsAuthToken?: string
  bilibiliSessionTokens: string[]
  userAgent: string
  transcriptByteLimit: number
}

/** Merge user-provided subtitle config with environment defaults. */
export function resolveSubtitleConfig(config: SubtitleConfig = {}): ResolvedSubtitleConfig {
  return {
    savesubsBaseUrl: config.savesubsBaseUrl ?? readEnv('SAVESUBS_BASE_URL') ?? DEFAULT_SAVESUBS_BASE_URL,
    savesubsAuthToken: config.savesubsAuthToken ?? readEnv('SAVESUBS_X_AUTH_TOKEN'),
    bilibiliSessionTokens: toStringArray(config.bilibiliSessionTokens ?? readEnv('BILIBILI_SESSION_TOKEN')),
    userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
    transcriptByteLimit: config.transcriptByteLimit ?? DEFAULT_TRANSCRIPT_BYTE_LIMIT,
  }
}
