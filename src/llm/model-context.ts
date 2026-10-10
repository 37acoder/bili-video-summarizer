/**
 * Model metadata used by the map-reduce chunker.
 *
 * The map stage caps each segment at a fraction of the model's context window,
 * so the chunker needs to know that window. The default model is DeepSeek V4.1
 * Flash (`deepseek-flash`, 1,048,576-token context); callers can still override
 * it per request via `SummarizeOptions.model`, and anything unknown falls back
 * to a conservative default.
 */

/** Default model when none is configured. */
export const DEFAULT_MODEL = 'deepseek-flash'

/** Context window (in tokens) for known models. */
export const MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  'deepseek-flash': 1_048_576,
  'deepseek-chat': 128_000,
  'deepseek-reasoner': 128_000,
  'gpt-3.5-turbo': 16_385,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
}

/** Conservative window assumed for models we do not know. */
export const DEFAULT_CONTEXT_WINDOW = 128_000

/**
 * Normalize a model id that may carry a provider prefix (`deepseek/x`) or a
 * variant suffix (`x#high`).
 */
function normalizeModelId(model: string): string {
  const afterSlash = model.includes('/') ? model.slice(model.lastIndexOf('/') + 1) : model
  return afterSlash.split('#')[0]?.trim() ?? ''
}

/** Resolve the context window (tokens) for a model id, falling back conservatively. */
export function resolveContextWindow(model?: string): number {
  if (!model) {
    return DEFAULT_CONTEXT_WINDOW
  }
  return MODEL_CONTEXT_WINDOWS[normalizeModelId(model)] ?? DEFAULT_CONTEXT_WINDOW
}

/**
 * Models that emit a hidden reasoning phase. For summarization that phase adds
 * cost and latency and — at a modest output budget — consumes it entirely,
 * leaving an empty answer. These models therefore default to thinking disabled.
 */
const REASONING_MODELS_DISABLED_BY_DEFAULT = new Set(['deepseek-flash'])

/**
 * Default `reasoning_effort` for a model: `'none'` for models whose thinking
 * phase would otherwise starve the answer, `undefined` otherwise (so no
 * `reasoning_effort` field is sent).
 */
export function defaultReasoningEffort(model?: string): string | undefined {
  return model && REASONING_MODELS_DISABLED_BY_DEFAULT.has(normalizeModelId(model)) ? 'none' : undefined
}
