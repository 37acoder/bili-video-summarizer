import { describe, expect, it } from 'vitest'
import { reduceSubtitleTimestamp } from '../src/subtitles/reduce-subtitle-timestamp'

describe('reduceSubtitleTimestamp', () => {
  it('groups lines and omits timestamps by default', () => {
    const subtitles = Array.from({ length: 8 }, (_, i) => ({ from: i, content: `line${i}` }))
    const result = reduceSubtitleTimestamp(subtitles, (i) => i.from, (i) => i.content, false)
    expect(result).toHaveLength(2)
    expect(result[0]?.text).not.toContain(' - ')
    expect(result[0]?.s).toBe(0)
    expect(result[0]?.text).toContain('line0')
    expect(result[1]?.text).toContain('line7')
  })

  it('prefixes each group with its start time when requested', () => {
    const subtitles = Array.from({ length: 8 }, (_, i) => ({ from: i * 2, content: `line${i}` }))
    const result = reduceSubtitleTimestamp(subtitles, (i) => i.from, (i) => i.content, true)
    expect(result[0]?.text.startsWith('0 - ')).toBe(true)
    expect(result[1]?.text.startsWith('14 - ')).toBe(true)
  })

  it('handles an empty list', () => {
    expect(reduceSubtitleTimestamp([], (i: number) => i, (i: number) => String(i))).toEqual([])
  })
})
