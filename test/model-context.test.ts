import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MODEL,
  defaultReasoningEffort,
  resolveContextWindow,
} from '../src/llm/model-context'

describe('resolveContextWindow', () => {
  it('knows the default model context window', () => {
    expect(DEFAULT_MODEL).toBe('deepseek-flash')
    expect(resolveContextWindow(DEFAULT_MODEL)).toBe(1_048_576)
  })

  it('ignores a variant suffix', () => {
    expect(resolveContextWindow('deepseek-flash#high')).toBe(1_048_576)
    expect(resolveContextWindow('deepseek/deepseek-flash')).toBe(1_048_576)
  })

  it('falls back for unknown or missing models', () => {
    expect(resolveContextWindow('some-unknown-model')).toBe(DEFAULT_CONTEXT_WINDOW)
    expect(resolveContextWindow(undefined)).toBe(DEFAULT_CONTEXT_WINDOW)
  })
})

describe('defaultReasoningEffort', () => {
  it('disables thinking for DeepSeek Flash (its budget otherwise starves the answer)', () => {
    expect(defaultReasoningEffort('deepseek-flash')).toBe('none')
    expect(defaultReasoningEffort('deepseek/deepseek-flash#high')).toBe('none')
  })

  it('leaves other models untouched', () => {
    expect(defaultReasoningEffort('gpt-4o')).toBeUndefined()
    expect(defaultReasoningEffort(undefined)).toBeUndefined()
  })
})
