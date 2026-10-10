import { describe, expect, it } from 'vitest'
import { buildUserPrompt, resolveMaxOutputTokens, resolveTargetSections } from '../src/prompt/prompt'

describe('buildUserPrompt (chaptered outline, default)', () => {
  it('embeds title, transcript, language and the requested chapter count', () => {
    const prompt = buildUserPrompt({
      title: 'My Video',
      transcript: 'hello world',
      options: { outputLanguage: 'zh-CN', sentenceNumber: 5 },
    })
    expect(prompt).toContain('Title: "My Video"')
    expect(prompt).toContain('hello world')
    expect(prompt).toContain('Simplified Chinese')
    expect(prompt).toContain('## 章节要点')
    expect(prompt).toContain('exactly 5 chapters')
  })

  it('asks for timestamps on chapter headings when requested', () => {
    const prompt = buildUserPrompt({
      title: '',
      transcript: 'a b c',
      options: { showTimestamp: true, sentenceNumber: 3 },
    })
    expect(prompt).toContain('start timestamp')
    expect(prompt).toContain('exactly 3 chapters')
  })

  it('adapts the chapter count to the video duration', () => {
    const prompt = buildUserPrompt({
      title: 'Long',
      transcript: '一段字幕',
      options: { outputLanguage: 'zh-CN' },
      durationSeconds: 676,
    })
    expect(prompt).toContain('exactly 6 chapters')
  })
})

describe('buildUserPrompt (legacy bullets format)', () => {
  it('uses the original template when summaryFormat is bullets', () => {
    const prompt = buildUserPrompt({
      title: 'My Video',
      transcript: 'hello world',
      options: { outputLanguage: 'zh-CN', sentenceNumber: 5, summaryFormat: 'bullets' },
    })
    expect(prompt).toContain('## Highlights')
    expect(prompt).toContain('up to 5')
  })

  it('uses the timestamp template when requested', () => {
    const prompt = buildUserPrompt({
      title: '',
      transcript: 'a b c',
      options: { showTimestamp: true, sentenceNumber: 3, summaryFormat: 'bullets' },
    })
    expect(prompt).toContain('start timestamp')
    expect(prompt).toContain('exactly 3 bullet points')
  })
})

describe('resolveTargetSections', () => {
  it('adapts to duration (~1 chapter per two minutes)', () => {
    expect(resolveTargetSections({ transcript: 'x', durationSeconds: 522 })).toBe(5)
    expect(resolveTargetSections({ transcript: 'x', durationSeconds: 676 })).toBe(6)
  })

  it('falls back to transcript size when the duration is unknown', () => {
    expect(resolveTargetSections({ transcript: '一'.repeat(12_000) })).toBe(10)
  })

  it('clamps to the supported range', () => {
    expect(resolveTargetSections({ transcript: 'x', durationSeconds: 3600 })).toBe(12)
  })

  it('prefers an explicit count', () => {
    expect(resolveTargetSections({ transcript: 'x', durationSeconds: 3600, explicit: 3 })).toBe(3)
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
