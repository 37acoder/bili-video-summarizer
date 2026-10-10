import { describe, expect, it } from 'vitest'
import { buildUserPrompt, resolveMaxOutputTokens } from '../src/prompt/prompt'

describe('buildUserPrompt', () => {
  it('embeds title, transcript and language', () => {
    const prompt = buildUserPrompt({
      title: 'My Video',
      transcript: 'hello world',
      options: { outputLanguage: 'zh-CN', sentenceNumber: 5 },
    })
    expect(prompt).toContain('Title: "My Video"')
    expect(prompt).toContain('hello world')
    expect(prompt).toContain('Simplified Chinese')
    expect(prompt).toContain('up to 5')
  })

  it('uses the timestamp template when requested', () => {
    const prompt = buildUserPrompt({
      title: '',
      transcript: 'a b c',
      options: { showTimestamp: true, sentenceNumber: 3 },
    })
    expect(prompt).toContain('start timestamp')
    expect(prompt).toContain('exactly 3 bullet points')
  })
})

describe('resolveMaxOutputTokens', () => {
  it('prefers an explicit override', () => {
    expect(resolveMaxOutputTokens({ maxOutputTokens: 123, detailLevel: 900 })).toBe(123)
  })

  it('falls back to detailLevel, then to a default', () => {
    expect(resolveMaxOutputTokens({ detailLevel: 700 })).toBe(700)
    expect(resolveMaxOutputTokens({})).toBe(600)
    expect(resolveMaxOutputTokens({}, true)).toBe(800)
  })
})
