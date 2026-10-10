/**
 * `createVideoSummarizer` — the extracted core pipeline:
 *
 *   video request
 *     -> fetch captions (YouTube / Bilibili)
 *     -> size-limit the transcript
 *     -> build the prompt
 *     -> call an OpenAI-compatible LLM (optionally streaming)
 *     -> (optionally) cache the result
 *
 * Every external dependency (LLM, fetch, cache, logger) is injectable, so the
 * module can be dropped into a Next.js route, a worker, or a CLI.
 */
import { createMemoryCache, getCacheId } from './cache'
import { resolveSubtitleConfig, type LlmConfig, type SubtitleConfig } from './config'
import { SummarizeError } from './errors'
import { createOpenAICompatibleClient, trimResult } from './llm/openai-compatible'
import { buildUserPrompt, DEFAULT_MODEL, resolveMaxOutputTokens } from './prompt/prompt'
import { fetchTranscript } from './subtitles'
import type {
  BuiltPrompt,
  CacheStore,
  FetchLike,
  GenerateParams,
  LlmClient,
  Logger,
  SummarizeInput,
  SummarizeOptions,
  TranscriptResult,
} from './types'
import { readEnv } from './utils/env'
import { noopLogger } from './utils/logger'

export interface VideoSummarizerOptions {
  /** Config for the default OpenAI-compatible LLM client. */
  llm?: LlmConfig
  /** Provide a custom LLM client; takes precedence over `llm`. */
  llmClient?: LlmClient
  /** Subtitle extraction config. */
  subtitle?: SubtitleConfig
  /** Result cache. Defaults to an in-memory cache. Pass `false` to disable. */
  cache?: CacheStore | false
  logger?: Logger
  /** Override `fetch` (defaults to the global). */
  fetch?: FetchLike
  /** Whether a (paid) user API key is in use; affects default max tokens. */
  hasUserKey?: boolean
}

export interface VideoSummarizer {
  /** Fetch captions and produce the final (size-limited) transcript text. */
  fetchTranscript(input: SummarizeInput): Promise<TranscriptResult>
  /** Build the fully-resolved prompt without calling the LLM. */
  buildPrompt(input: SummarizeInput): Promise<BuiltPrompt>
  /** Deterministic cache key for a request. */
  cacheKey(input: SummarizeInput): string
  /** Summarize and return the complete text. */
  summarize(input: SummarizeInput): Promise<string>
  /** Summarize and return a token stream. */
  summarizeStream(input: SummarizeInput): Promise<AsyncIterable<string>>
}

function llmParams(options: SummarizeOptions = {}): Omit<GenerateParams, 'model' | 'messages' | 'maxOutputTokens'> {
  return {
    temperature: options.temperature,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
    signal: options.signal,
  }
}

async function* singleChunk(text: string): AsyncIterable<string> {
  yield text
}

/** Accumulate a stream while forwarding chunks, then cache once complete. */
async function* streamWithCache(
  source: AsyncIterable<string>,
  key: string,
  cache: CacheStore | false | undefined,
  logger: Logger,
): AsyncIterable<string> {
  let accumulated = ''
  let completed = false
  try {
    for await (const chunk of source) {
      accumulated += chunk
      yield chunk
    }
    completed = true
  } finally {
    if (completed && accumulated && cache) {
      try {
        await cache.set(key, accumulated)
      } catch (error) {
        logger.warn('failed to write stream result to cache', error)
      }
    }
  }
}

export function createVideoSummarizer(options: VideoSummarizerOptions = {}): VideoSummarizer {
  const logger = options.logger ?? noopLogger
  const subtitleConfig = resolveSubtitleConfig(options.subtitle)
  const fetchImpl: FetchLike = options.fetch ?? globalThis.fetch
  if (!fetchImpl) {
    throw new Error('No fetch implementation available; pass `fetch` in the options.')
  }
  const client: LlmClient = options.llmClient ?? createOpenAICompatibleClient(options.llm, logger)
  const cache: CacheStore | false = options.cache ?? createMemoryCache()
  const hasUserKey = options.hasUserKey ?? Boolean(options.llm?.apiKey)

  function cacheKey(input: SummarizeInput): string {
    return getCacheId(input)
  }

  async function fetchTranscriptFor(input: SummarizeInput): Promise<TranscriptResult> {
    return fetchTranscript(input, subtitleConfig, { fetch: fetchImpl, config: subtitleConfig, logger })
  }

  async function buildPrompt(input: SummarizeInput): Promise<BuiltPrompt> {
    const { video } = input
    if (!video?.videoId) {
      throw new SummarizeError(500, 'NO_VIDEO_ID', 'No videoId in the request')
    }

    const transcript = input.transcript ?? (await fetchTranscriptFor(input))
    if (
      (!transcript.subtitlesArray || transcript.subtitlesArray.length === 0) &&
      transcript.usedDescription &&
      !transcript.descriptionText
    ) {
      logger.error('No subtitle in the video: ', video.videoId)
      throw new SummarizeError(501, 'NO_TRANSCRIPT', 'No subtitle in the video')
    }

    const prompt = buildUserPrompt({
      title: transcript.title,
      transcript: transcript.transcriptText,
      options: input.options,
      transcriptByteLimit: subtitleConfig.transcriptByteLimit,
    })

    const model =
      input.options?.model ?? options.llm?.model ?? readEnv('OPENAI_COMPATIBLE_MODEL') ?? DEFAULT_MODEL
    const maxOutputTokens = resolveMaxOutputTokens(input.options, hasUserKey)

    return {
      videoId: video.videoId,
      source: video.source,
      title: transcript.title,
      model,
      messages: [{ role: 'user', content: prompt }],
      prompt,
      maxOutputTokens,
    }
  }

  async function summarize(input: SummarizeInput): Promise<string> {
    const key = cacheKey(input)
    if (cache) {
      const cached = await cache.get(key)
      if (cached) {
        logger.debug('cache hit', key)
        return cached
      }
    }

    const built = await buildPrompt(input)
    const raw = await client.generate({
      model: built.model,
      messages: built.messages,
      maxOutputTokens: built.maxOutputTokens,
      ...llmParams(input.options),
    })
    const result = trimResult(raw)

    if (cache) {
      try {
        await cache.set(key, result)
      } catch (error) {
        logger.warn('failed to write result to cache', error)
      }
    }
    return result
  }

  async function summarizeStream(input: SummarizeInput): Promise<AsyncIterable<string>> {
    const key = cacheKey(input)
    if (cache) {
      const cached = await cache.get(key)
      if (cached) {
        logger.debug('cache hit (stream)', key)
        return singleChunk(cached)
      }
    }

    const built = await buildPrompt(input)
    const source = await client.stream({
      model: built.model,
      messages: built.messages,
      maxOutputTokens: built.maxOutputTokens,
      ...llmParams(input.options),
    })
    return streamWithCache(source, key, cache, logger)
  }

  return { fetchTranscript: fetchTranscriptFor, buildPrompt, cacheKey, summarize, summarizeStream }
}
