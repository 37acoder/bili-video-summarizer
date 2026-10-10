/**
 * `createVideoSummarizer` — the extracted core pipeline:
 *
 *   video request
 *     -> fetch captions (YouTube / Bilibili)
 *     -> split the transcript into model-sized segments (map-reduce)
 *     -> build the prompt(s)
 *     -> call an OpenAI-compatible LLM (optionally streaming)
 *     -> (optionally) cache the result
 *
 * Long transcripts used to be randomly truncated to a fixed byte budget. They
 * are now summarized with map-reduce: each segment (capped at a fraction of the
 * model's context window) is summarized independently, then the segment
 * summaries are merged while carrying the accumulated context forward. Every
 * external dependency (LLM, fetch, cache, logger) is injectable.
 */
import { createMemoryCache, getCacheId } from './cache'
import { resolveSubtitleConfig, type LlmConfig, type SubtitleConfig } from './config'
import { SummarizeError } from './errors'
import { createOpenAICompatibleClient, trimResult } from './llm/openai-compatible'
import { resolveContextWindow, defaultReasoningEffort } from './llm/model-context'
import {
  buildMapPrompt,
  buildUserPrompt,
  DEFAULT_MODEL,
  OUTLINE_TOKENS_PER_SECTION,
  resolveMaxOutputTokens,
  resolveTargetSections,
} from './prompt/prompt'
import {
  resolveTranscriptChunks,
  summarizeMapReduce,
  summarizeMapReduceStream,
  transcriptDurationSeconds,
  type MapReduceDeps,
} from './summarize/map-reduce'
import {
  buildGroundedTranscriptSummary,
  DEFAULT_MIN_TRANSCRIPT_TOKENS,
  DEFAULT_MISSING_TRANSCRIPT_POLICY,
  isMissingTranscript,
  type MissingTranscriptPolicy,
} from './summarize/missing-transcript'
import { fetchTranscriptWithLocal } from './transcription/fetch'
import type { LocalTranscriptionOptions } from './transcription/types'
import type {
  BuiltPrompt,
  BuiltPromptStage,
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
import { resolveLanguageName } from './prompt/language'

export interface VideoSummarizerOptions {
  /** Config for the default OpenAI-compatible LLM client. */
  llm?: LlmConfig
  /** Provide a custom LLM client; takes precedence over `llm`. */
  llmClient?: LlmClient
  /** Subtitle extraction config. */
  subtitle?: SubtitleConfig
  /** Opt-in local fallback for explicitly absent captions. Never installs dependencies. */
  localTranscription?: LocalTranscriptionOptions | false
  /** Result cache. Defaults to an in-memory cache. Pass `false` to disable. */
  cache?: CacheStore | false
  logger?: Logger
  /** Override `fetch` (defaults to the global). */
  fetch?: FetchLike
  /** Whether a (paid) user API key is in use; affects default max tokens. */
  hasUserKey?: boolean
  /**
   * Default handling for a missing/too-thin transcript, overridable per request
   * via `options.onMissingTranscript`. Defaults to `'throw'`; set `'degrade'`
   * to opt in to the deterministic grounded fallback.
   */
  onMissingTranscript?: MissingTranscriptPolicy
  /**
   * Default minimum usable transcript size in estimated tokens, overridable per
   * request via `options.minTranscriptTokens`. Defaults to 40.
   */
  minTranscriptTokens?: number
}

export interface VideoSummarizer {
  /** Fetch captions and produce the final transcript text. */
  fetchTranscript(input: SummarizeInput): Promise<TranscriptResult>
  /** Build the fully-resolved prompt (without calling the LLM). */
  buildPrompt(input: SummarizeInput): Promise<BuiltPrompt>
  /** Deterministic request cache key; local ASR mode appends a resolved content fingerprint internally. */
  cacheKey(input: SummarizeInput): string
  /** Summarize and return the complete text. */
  summarize(input: SummarizeInput): Promise<string>
  /** Summarize and return a token stream. */
  summarizeStream(input: SummarizeInput): Promise<AsyncIterable<string>>
}

type SamplingParams = Pick<
  GenerateParams,
  'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty' | 'reasoningEffort'
>

function samplingParams(options: SummarizeOptions = {}, reasoningEffort?: string): SamplingParams {
  return {
    reasoningEffort,
    temperature: options.temperature,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
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
  const defaultMissingPolicy: MissingTranscriptPolicy =
    options.onMissingTranscript ?? DEFAULT_MISSING_TRANSCRIPT_POLICY
  const defaultMinTranscriptTokens = options.minTranscriptTokens ?? DEFAULT_MIN_TRANSCRIPT_TOKENS

  function cacheKey(input: SummarizeInput): string {
    if (!options.localTranscription) return getCacheId(input)
    return `${getCacheId(input)}-local-v1-${encodeURIComponent(JSON.stringify({ source: input.video.source, page: input.video.pageNumber ?? 1, model: options.localTranscription.model, path: options.localTranscription.modelPath, language: options.localTranscription.language, config: options.localTranscription.configFile }))}`
  }

  function resolveMissingPolicy(input: SummarizeInput): MissingTranscriptPolicy {
    return input.options?.onMissingTranscript ?? defaultMissingPolicy
  }

  function resolveMinTranscriptTokens(input: SummarizeInput): number {
    const value = input.options?.minTranscriptTokens
    return typeof value === 'number' && Number.isFinite(value) ? value : defaultMinTranscriptTokens
  }

  async function fetchTranscriptFor(input: SummarizeInput): Promise<TranscriptResult> {
    return fetchTranscriptWithLocal(input, subtitleConfig, { fetch: fetchImpl, config: subtitleConfig, logger }, options.localTranscription)
  }

  function resolveModel(input: SummarizeInput): string {
    return input.options?.model ?? options.llm?.model ?? readEnv('OPENAI_COMPATIBLE_MODEL') ?? DEFAULT_MODEL
  }

  interface ResolvedRequest {
    transcript: TranscriptResult
    model: string
    maxOutputTokens: number
    deps: MapReduceDeps
    /**
     * Deterministic grounded fallback for a missing/too-thin transcript. When
     * set, the caller must return it verbatim instead of calling the LLM.
     */
    grounded?: string
  }

  async function resolveRequest(input: SummarizeInput): Promise<ResolvedRequest> {
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

    // A description-only or too-thin transcript never reaches the chaptered
    // outline: either the caller asked for a throw, or we return a grounded,
    // explicitly-labelled fallback that cannot fabricate chapters/timestamps.
    let grounded: string | undefined
    if (isMissingTranscript(transcript, resolveMinTranscriptTokens(input))) {
      if (resolveMissingPolicy(input) === 'throw') {
        logger.error('No usable transcript in the video: ', video.videoId)
        throw new SummarizeError(501, 'NO_TRANSCRIPT', 'No usable transcript in the video')
      }
      grounded = buildGroundedTranscriptSummary(transcript, input.options)
    }

    const model = resolveModel(input)
    const durationSeconds = transcriptDurationSeconds(transcript.subtitlesArray)
    const baseMaxOutputTokens = resolveMaxOutputTokens(input.options, hasUserKey)
    // The chaptered outline needs more output room than the legacy bullets;
    // scale it with the adaptive chapter count unless the caller pinned
    // `maxOutputTokens` (or chose the bullets format).
    const isOutline = (input.options?.summaryFormat ?? 'outline') === 'outline'
    const maxOutputTokens =
      input.options?.maxOutputTokens !== undefined || !isOutline
        ? baseMaxOutputTokens
        : Math.max(
            baseMaxOutputTokens,
            resolveTargetSections({
              transcript: transcript.transcriptText,
              durationSeconds,
              explicit: input.options?.sentenceNumber,
            }) * OUTLINE_TOKENS_PER_SECTION,
          )
    const reasoningEffort =
      input.options?.reasoningEffort ??
      options.llm?.reasoningEffort ??
      readEnv('OPENAI_COMPATIBLE_REASONING_EFFORT') ??
      defaultReasoningEffort(model)
    const deps: MapReduceDeps = {
      llm: client,
      model,
      options: input.options,
      maxOutputTokens,
      contextWindow: resolveContextWindow(model),
      params: samplingParams(input.options, reasoningEffort),
      signal: input.options?.signal,
      logger,
      transcriptionNotice: transcript.transcription ? 'Source: local automatic transcription (whisper.cpp). Clearly label this source in the summary. Preserve uncertain names, numbers, negations and possible recognition errors as uncertainties; do not silently invent corrections.' : undefined,
    }
    return { transcript, model, maxOutputTokens, deps, grounded }
  }

  async function buildPrompt(input: SummarizeInput): Promise<BuiltPrompt> {
    const { transcript, model, maxOutputTokens, deps, grounded } = await resolveRequest(input)
    const { video } = input

    // No LLM call is made for a missing transcript; expose the deterministic
    // grounded result under a dedicated `grounded` stage instead of a prompt.
    if (grounded !== undefined) {
      return {
        videoId: video.videoId,
        source: video.source,
        title: transcript.title,
        model,
        messages: [{ role: 'user', content: grounded }],
        prompt: grounded,
        maxOutputTokens,
        chunks: 1,
        stages: [{ kind: 'grounded', prompt: grounded }],
      }
    }

    const chunks = resolveTranscriptChunks(transcript, deps)
    let stages: BuiltPromptStage[]
    if (chunks.length <= 1) {
      const prompt = buildUserPrompt({
        title: transcript.title,
        transcript: chunks[0]?.text ?? transcript.transcriptText,
        options: input.options,
        durationSeconds: transcriptDurationSeconds(transcript.subtitlesArray),
      })
      stages = [{ kind: 'single', prompt }]
    } else {
      stages = chunks.map((chunk, index) => ({
        kind: 'map' as const,
        prompt: buildMapPrompt({
          title: transcript.title,
          segmentText: chunk.text,
          segmentIndex: index,
          segmentCount: chunks.length,
          options: input.options,
        }),
      }))
    }

    if (deps.transcriptionNotice) stages = stages.map(stage => ({ ...stage, prompt: `${deps.transcriptionNotice}\n\n${stage.prompt}` }))
    const prompt = stages[0]?.prompt ?? ''
    return {
      videoId: video.videoId,
      source: video.source,
      title: transcript.title,
      model,
      messages: [{ role: 'user', content: prompt }],
      prompt,
      maxOutputTokens,
      chunks: chunks.length,
      stages,
    }
  }

  async function summarize(input: SummarizeInput): Promise<string> {
    const resolved = options.localTranscription ? await resolveRequest(input) : undefined
    const key = await resolvedCacheKey(input, resolved)
    if (cache) {
      const cached = await cache.get(key)
      if (cached) {
        logger.debug('cache hit', key)
        return cached
      }
    }

    const { transcript, deps, grounded } = resolved ?? await resolveRequest(input)
    const summary =
      grounded !== undefined ? grounded : trimResult((await summarizeMapReduce(transcript, deps)).summary)
    const result = transcript.transcription ? `${sourceLabel(transcript, input)}\n\n${summary}` : summary

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
    const resolved = options.localTranscription ? await resolveRequest(input) : undefined
    const key = await resolvedCacheKey(input, resolved)
    if (cache) {
      const cached = await cache.get(key)
      if (cached) {
        logger.debug('cache hit (stream)', key)
        return singleChunk(cached)
      }
    }

    const { transcript, deps, grounded } = resolved ?? await resolveRequest(input)
    const rawSource =
      grounded !== undefined ? singleChunk(grounded) : await summarizeMapReduceStream(transcript, deps)
    const source = transcript.transcription ? labelStream(rawSource, sourceLabel(transcript, input)) : rawSource
    return streamWithCache(source, key, cache, logger)
  }

  function sourceLabel(transcript: TranscriptResult, input: SummarizeInput) {
    const metadata = transcript.transcription!
    return /chinese/i.test(resolveLanguageName(input.options?.outputLanguage))
      ? `> 来源：本地自动转录（${metadata.engine}，${metadata.model}）；可能存在识别错误。`
      : `> Source: local automatic transcription (${metadata.engine}, ${metadata.model}); recognition errors may remain.`
  }
  async function* labelStream(source: AsyncIterable<string>, label: string) { yield `${label}\n\n`; yield* source }

  async function resolvedCacheKey(input: SummarizeInput, resolved?: ResolvedRequest) {
    if (!resolved) return cacheKey(input)
    const { fingerprint } = await import('./transcription/environment')
    return `${cacheKey(input)}-${fingerprint({ transcript: resolved.transcript, model: resolved.model, options: input.options })}`
  }

  return { fetchTranscript: fetchTranscriptFor, buildPrompt, cacheKey, summarize, summarizeStream }
}
