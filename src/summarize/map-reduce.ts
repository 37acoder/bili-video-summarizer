/**
 * Map-reduce summarization.
 *
 * Long transcripts are split into chunks capped at a fraction of the model's
 * context window (`splitTranscript`), each chunk is summarized independently
 * (map), and the per-chunk summaries are folded together (reduce). The reduce
 * step carries the accumulated summary forward and re-reads the raw subtitles
 * straddling each chunk seam, so section transitions are not lost between
 * segment summaries.
 *
 * The module is a pure orchestration over an injected `LlmClient`; it owns no
 * I/O beyond that seam, which is what makes it testable and reusable.
 */
import {
  buildMapPrompt,
  buildReducePrompt,
  buildUserPrompt,
  resolveTargetSections,
} from '../prompt/prompt'
import { DEFAULT_MODEL } from '../llm/model-context'
import {
  DEFAULT_EDGE_LINES,
  seamText,
  splitTranscript,
  type TranscriptChunk,
} from '../transcript/chunk-transcript'
import type {
  CommonSubtitleItem,
  GenerateParams,
  LlmClient,
  Logger,
  SummarizeOptions,
} from '../types'
import { noopLogger } from '../utils/logger'

/** Fraction of the model context window a single map segment may occupy. */
export const DEFAULT_CONTEXT_RATIO = 0.5

/** Tokens reserved on top of the output budget for prompt scaffolding. */
export const PROMPT_OVERHEAD_TOKENS = 200

/** The pieces of a `TranscriptResult` the map-reduce stage needs. */
export interface MapReduceTranscript {
  title: string
  subtitlesArray: CommonSubtitleItem[] | null
  transcriptText: string
}

export interface MapReduceDeps {
  llm: LlmClient
  /** Model id forwarded to every call. */
  model?: string
  options?: SummarizeOptions
  maxOutputTokens: number
  /** The model's context window in tokens (see `resolveContextWindow`). */
  contextWindow: number
  /** Fraction of the context window a segment may use. Defaults to 0.5. */
  contextRatio?: number
  /** Tokens reserved for prompt scaffolding + output. Defaults to `maxOutputTokens + 200`. */
  reserveTokens?: number
  /** Raw subtitle lines kept on each side of a chunk seam. */
  edgeLines?: number
  /** Extra generation params forwarded to every call. */
  params?: Pick<
    GenerateParams,
    'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty' | 'reasoningEffort'
  >
  signal?: AbortSignal
  logger?: Logger
}

export interface MapReduceResult {
  summary: string
  /** Number of map segments the transcript was split into. */
  chunks: number
  /** One summary per segment; `null` marks a segment whose map call failed. */
  mapSummaries: (string | null)[]
}

/** Per-segment token budget derived from the context window. */
export function resolveChunkTokenBudget(
  deps: Pick<MapReduceDeps, 'contextWindow' | 'contextRatio' | 'reserveTokens' | 'maxOutputTokens'>,
): number {
  const contextBudget = Math.floor(deps.contextWindow * (deps.contextRatio ?? DEFAULT_CONTEXT_RATIO))
  const reserve = deps.reserveTokens ?? deps.maxOutputTokens + PROMPT_OVERHEAD_TOKENS
  return Math.max(1, contextBudget - reserve)
}

/** Resolve the ordered map segments for a transcript (single segment as fallback). */
export function resolveTranscriptChunks(
  transcript: MapReduceTranscript,
  deps: Pick<MapReduceDeps, 'contextWindow' | 'contextRatio' | 'reserveTokens' | 'maxOutputTokens'>,
): TranscriptChunk[] {
  const items = transcript.subtitlesArray
  if (items && items.length > 0) {
    return splitTranscript(items, { maxTokensPerChunk: resolveChunkTokenBudget(deps) })
  }
  return [{ items: [], text: transcript.transcriptText, startIndex: 0, endIndex: 0 }]
}

/** Last start time in the subtitle groups, used to adapt the outline length. */
export function transcriptDurationSeconds(items: CommonSubtitleItem[] | null | undefined): number | undefined {
  if (!items?.length) {
    return undefined
  }
  let max = Number.NEGATIVE_INFINITY
  for (const item of items) {
    const seconds = typeof item.s === 'number' ? item.s : Number(item.s)
    if (Number.isFinite(seconds)) {
      max = Math.max(max, seconds)
    }
  }
  return Number.isFinite(max) ? max : undefined
}

function generateParams(prompt: string, deps: MapReduceDeps): GenerateParams {
  return {
    model: deps.model ?? DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    maxOutputTokens: deps.maxOutputTokens,
    reasoningEffort: deps.params?.reasoningEffort,
    temperature: deps.params?.temperature,
    topP: deps.params?.topP,
    frequencyPenalty: deps.params?.frequencyPenalty,
    presencePenalty: deps.params?.presencePenalty,
    signal: deps.signal,
  }
}

interface MapOutcome {
  summaries: (string | null)[]
  firstError: unknown
}

/** Summarize every chunk; a failed segment is logged and skipped. */
async function runMap(
  chunks: TranscriptChunk[],
  transcript: MapReduceTranscript,
  deps: MapReduceDeps,
  logger: Logger,
): Promise<MapOutcome> {
  const summaries: (string | null)[] = []
  let firstError: unknown
  for (let i = 0; i < chunks.length; i++) {
    const prompt = buildMapPrompt({
      title: transcript.title,
      segmentText: chunks[i]?.text ?? '',
      segmentIndex: i,
      segmentCount: chunks.length,
      options: deps.options,
    })
    try {
      summaries.push(await deps.llm.generate(generateParams(prompt, deps)))
    } catch (error) {
      if (firstError === undefined) {
        firstError = error
      }
      logger.warn(`map segment ${i + 1}/${chunks.length} failed; skipping`, error)
      summaries.push(null)
    }
  }
  return { summaries, firstError }
}

function lastSummaryIndex(summaries: (string | null)[]): number {
  for (let i = summaries.length - 1; i >= 0; i--) {
    if (summaries[i] != null) return i
  }
  return -1
}

/**
 * Fold segment summaries into one, carrying the accumulated summary forward.
 * When `streamLast` is set the final reduce call is streamed (the earlier ones
 * are buffered); the caller then receives an `AsyncIterable<string>`.
 */
async function foldReduce(
  chunks: TranscriptChunk[],
  summaries: (string | null)[],
  transcript: MapReduceTranscript,
  deps: MapReduceDeps,
  logger: Logger,
  streamLast: boolean,
): Promise<string | AsyncIterable<string>> {
  const edgeLines = deps.edgeLines ?? DEFAULT_EDGE_LINES
  const finalIndex = lastSummaryIndex(summaries)
  const targetSections = resolveTargetSections({
    transcript: transcript.transcriptText,
    durationSeconds: transcriptDurationSeconds(transcript.subtitlesArray),
    explicit: deps.options?.sentenceNumber,
  })

  let accumulated: string | null = null
  let startIndex = -1
  for (let i = 0; i < summaries.length; i++) {
    const summary = summaries[i]
    if (summary != null) {
      accumulated = summary
      startIndex = i
      break
    }
  }
  if (accumulated == null || startIndex < 0) {
    throw new Error('map-reduce: no segment summaries to reduce')
  }

  for (let i = startIndex + 1; i <= finalIndex; i++) {
    const segmentSummary = summaries[i]
    if (segmentSummary == null) {
      continue
    }
    const previous = chunks[i - 1]
    const current = chunks[i]
    const prompt = buildReducePrompt({
      title: transcript.title,
      priorSummary: accumulated,
      segmentSummary,
      seamSubtitle: previous && current ? seamText(previous, current, edgeLines) : undefined,
      targetSections,
      options: deps.options,
    })
    if (streamLast && i === finalIndex) {
      return deps.llm.stream(generateParams(prompt, deps))
    }
    try {
      accumulated = await deps.llm.generate(generateParams(prompt, deps))
    } catch (error) {
      logger.warn(`reduce step for segment ${i + 1} failed; keeping accumulated summary`, error)
    }
  }
  return accumulated
}

async function* singleChunk(text: string): AsyncIterable<string> {
  yield text
}

function singleChunkPrompt(transcript: MapReduceTranscript, chunks: TranscriptChunk[], deps: MapReduceDeps): string {
  return buildUserPrompt({
    title: transcript.title,
    transcript: chunks[0]?.text ?? transcript.transcriptText,
    options: deps.options,
    durationSeconds: transcriptDurationSeconds(transcript.subtitlesArray),
  })
}

/** Summarize a transcript end-to-end with map-reduce, returning the final text. */
export async function summarizeMapReduce(
  transcript: MapReduceTranscript,
  deps: MapReduceDeps,
): Promise<MapReduceResult> {
  const logger = deps.logger ?? noopLogger
  const chunks = resolveTranscriptChunks(transcript, deps)

  if (chunks.length <= 1) {
    const prompt = singleChunkPrompt(transcript, chunks, deps)
    const summary = await deps.llm.generate(generateParams(prompt, deps))
    return { summary, chunks: chunks.length, mapSummaries: [summary] }
  }

  const { summaries, firstError } = await runMap(chunks, transcript, deps, logger)
  if (summaries.every((summary) => summary == null)) {
    throw firstError ?? new Error('map-reduce: every segment failed')
  }

  const summary = (await foldReduce(chunks, summaries, transcript, deps, logger, false)) as string
  return { summary, chunks: chunks.length, mapSummaries: summaries }
}

/**
 * Streaming variant: map (buffered) + rolling reduce, with only the final call
 * streamed so callers get progressive output of the merged summary.
 */
export async function summarizeMapReduceStream(
  transcript: MapReduceTranscript,
  deps: MapReduceDeps,
): Promise<AsyncIterable<string>> {
  const logger = deps.logger ?? noopLogger
  const chunks = resolveTranscriptChunks(transcript, deps)

  if (chunks.length <= 1) {
    return deps.llm.stream(generateParams(singleChunkPrompt(transcript, chunks, deps), deps))
  }

  const { summaries, firstError } = await runMap(chunks, transcript, deps, logger)
  if (summaries.every((summary) => summary == null)) {
    throw firstError ?? new Error('map-reduce: every segment failed')
  }

  const reduced = await foldReduce(chunks, summaries, transcript, deps, logger, true)
  return typeof reduced === 'string' ? singleChunk(reduced) : reduced
}
