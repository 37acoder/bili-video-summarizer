import { describe, expect, it } from 'vitest'
import { seamText, splitTranscript } from '../src/transcript/chunk-transcript'

/** Each `w<i>` costs one token (4 ASCII chars / 4). */
const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `w${i}`, index: i }))

describe('splitTranscript', () => {
  it('splits items into chunks that respect the token budget', () => {
    const chunks = splitTranscript(makeItems(5), { maxTokensPerChunk: 2 })
    expect(chunks).toHaveLength(3)
    expect(chunks[0]?.items.map((i) => i.text)).toEqual(['w0', 'w1'])
    expect(chunks[1]?.items.map((i) => i.text)).toEqual(['w2', 'w3'])
    expect(chunks[2]?.items.map((i) => i.text)).toEqual(['w4'])
  })

  it('joins each chunk text in chronological order', () => {
    const chunks = splitTranscript(makeItems(4), { maxTokensPerChunk: 2 })
    expect(chunks[0]?.text).toBe('w0 w1')
    expect(chunks[1]?.text).toBe('w2 w3')
  })

  it('sorts by index before chunking', () => {
    const shuffled = [
      { text: 'w1', index: 1 },
      { text: 'w0', index: 0 },
    ]
    const chunks = splitTranscript(shuffled, { maxTokensPerChunk: 10 })
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.items.map((i) => i.text)).toEqual(['w0', 'w1'])
  })

  it('keeps an oversized item as its own chunk', () => {
    const big = { text: 'x'.repeat(40), index: 0 } // 10 tokens
    const chunks = splitTranscript([big, ...makeItems(2)], { maxTokensPerChunk: 3 })
    expect(chunks[0]?.items).toEqual([big])
    expect(chunks[1]?.items.map((i) => i.text)).toEqual(['w0', 'w1'])
  })

  it('returns an empty list for empty input', () => {
    expect(splitTranscript([], { maxTokensPerChunk: 10 })).toEqual([])
  })
})

describe('seamText', () => {
  it('returns the previous chunk tail and the next chunk head', () => {
    const chunks = splitTranscript(makeItems(4), { maxTokensPerChunk: 2 })
    expect(seamText(chunks[0]!, chunks[1]!, 1)).toBe('w1 w2')
  })

  it('includes the whole chunk when it is shorter than the edge size', () => {
    const chunks = splitTranscript(makeItems(4), { maxTokensPerChunk: 2 })
    expect(seamText(chunks[0]!, chunks[1]!, 3)).toBe('w0 w1 w2 w3')
  })
})
