import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRANSCRIPT_BYTE_LIMIT,
  getByteLength,
  getSmallSizeTranscripts,
  limitTranscriptByteLength,
} from '../src/transcript/small-size-transcripts'

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ text: `句子 ${i} 内容`, index: i }))

describe('limitTranscriptByteLength', () => {
  it('returns short text unchanged', () => {
    expect(limitTranscriptByteLength('hello')).toBe('hello')
  })

  it('truncates to the byte budget', () => {
    const long = 'a'.repeat(1000)
    const result = limitTranscriptByteLength(long, 100)
    expect(getByteLength(result)).toBeLessThanOrEqual(100)
  })
})

describe('getSmallSizeTranscripts', () => {
  it('joins short transcripts in order', () => {
    const items = [
      { text: 'a', index: 1 },
      { text: 'b', index: 0 },
    ]
    expect(getSmallSizeTranscripts(items, items)).toBe('b a')
  })

  it('keeps the result within the byte limit for large inputs', () => {
    const items = makeItems(5000)
    const raw = items.map((t) => t.text).join(' ')
    const result = getSmallSizeTranscripts(items, items)
    expect(getByteLength(raw)).toBeGreaterThan(DEFAULT_TRANSCRIPT_BYTE_LIMIT)
    expect(getByteLength(result)).toBeLessThanOrEqual(DEFAULT_TRANSCRIPT_BYTE_LIMIT)
    expect(result.length).toBeGreaterThan(0)
  })
})
