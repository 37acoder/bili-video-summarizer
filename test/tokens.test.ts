import { describe, expect, it } from 'vitest'
import { estimateTokens } from '../src/utils/tokens'

describe('estimateTokens', () => {
  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('counts each CJK character as roughly one token', () => {
    expect(estimateTokens('中文')).toBe(2)
    expect(estimateTokens('一段比较长的中文内容')).toBe(10)
  })

  it('counts ASCII at about four characters per token', () => {
    expect(estimateTokens('a'.repeat(100))).toBe(25)
  })

  it('handles mixed scripts', () => {
    // 2 CJK tokens + ceil(3 / 4) = 1 for the ASCII tail
    expect(estimateTokens('中文abc')).toBe(3)
  })

  it('is monotonic in length', () => {
    expect(estimateTokens('一段比较长的中文内容')).toBeGreaterThan(estimateTokens('短'))
  })
})
