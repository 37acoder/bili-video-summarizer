/**
 * Transcript chunking for map-reduce summarization.
 *
 * The old size limiter randomly dropped subtitle lines when a transcript
 * exceeded a fixed byte budget. Instead, the transcript is now split into
 * ordered chunks whose token estimate stays within a per-chunk budget, so no
 * content is discarded. The budget is passed in by the caller (the map-reduce
 * orchestrator derives it from the model's context window).
 */
import type { CommonSubtitleItem } from '../types'
import { estimateTokens } from '../utils/tokens'

/** Default number of subtitle lines included from each side of a chunk seam. */
export const DEFAULT_EDGE_LINES = 3

/** A contiguous slice of subtitle items that fits one map call. */
export interface TranscriptChunk {
  items: CommonSubtitleItem[]
  /** Items joined chronologically, matching the historical transcript format. */
  text: string
  startIndex: number
  endIndex: number
}

export interface SplitTranscriptOptions {
  /** Maximum estimated tokens per chunk. */
  maxTokensPerChunk: number
}

function makeChunk(items: CommonSubtitleItem[]): TranscriptChunk {
  const first = items[0] as CommonSubtitleItem
  const last = items[items.length - 1] as CommonSubtitleItem
  return {
    items,
    text: items.map((item) => item.text).join(' '),
    startIndex: first.index,
    endIndex: last.index,
  }
}

/**
 * Split subtitle items into chronological chunks within the token budget.
 * An item that alone exceeds the budget becomes its own chunk (items are
 * atomic; a single subtitle group is tiny in practice).
 */
export function splitTranscript(
  items: readonly CommonSubtitleItem[] = [],
  { maxTokensPerChunk }: SplitTranscriptOptions,
): TranscriptChunk[] {
  const budget = Math.max(1, Math.floor(maxTokensPerChunk))
  const sorted = items.slice().sort((a, b) => a.index - b.index)
  const chunks: TranscriptChunk[] = []
  let current: CommonSubtitleItem[] = []
  let currentTokens = 0

  for (const item of sorted) {
    const tokens = estimateTokens(item.text)
    if (current.length > 0 && currentTokens + tokens > budget) {
      chunks.push(makeChunk(current))
      current = []
      currentTokens = 0
    }
    current.push(item)
    currentTokens += tokens
  }
  if (current.length > 0) {
    chunks.push(makeChunk(current))
  }
  return chunks
}

/**
 * Raw subtitle text around the seam between two adjacent chunks: the tail of
 * the previous chunk followed by the head of the next. Fed into the reduce step
 * so section transitions are not lost between segment summaries.
 */
export function seamText(
  previous: TranscriptChunk,
  next: TranscriptChunk,
  edgeLines: number = DEFAULT_EDGE_LINES,
): string {
  const tail = previous.items.slice(-edgeLines).map((item) => item.text)
  const head = next.items.slice(0, edgeLines).map((item) => item.text)
  return [...tail, ...head].join(' ')
}
