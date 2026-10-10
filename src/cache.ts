/**
 * Cache helpers.
 *
 * Ported from BibiGPT-v1 `utils/getCacheId.ts`. The in-memory store is a
 * dependency-free default for local/dev use; production integrations should
 * provide their own `CacheStore` (Redis, KV, ...).
 */
import type { CacheStore, SummarizeInput } from './types'

function normalizeModelId(model?: string): string {
  return (model || 'default').replace(/[^\w.-]/g, '_')
}

/** Deterministic cache key for a summarize request. */
export function getCacheId(input: SummarizeInput): string {
  const { video, options = {} } = input
  const prefix = options.showTimestamp ? 'timestamp-' : ''
  const language = options.outputLanguage ?? 'default'
  const detailLevel = options.detailLevel ?? 'default'
  const base = `${prefix}${video.videoId}-${language}-${detailLevel}-${normalizeModelId(options.model)}`
  // Missing-transcript handling changes the output, so include it when the
  // caller sets it. Left off when unset, keeping existing cache keys stable.
  const extras: string[] = []
  if (options.onMissingTranscript) {
    extras.push(`missing-${options.onMissingTranscript}`)
  }
  if (options.minTranscriptTokens !== undefined) {
    extras.push(`min-${options.minTranscriptTokens}`)
  }
  return extras.length > 0 ? `${base}-${extras.join('-')}` : base
}

/** A simple in-memory `CacheStore`. Not shared across processes. */
export function createMemoryCache(): CacheStore {
  const store = new Map<string, string>()
  return {
    async get(key) {
      return store.get(key)
    },
    async set(key, value) {
      store.set(key, value)
    },
  }
}
