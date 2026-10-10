import { describe, expect, it } from 'vitest'
import {
  buildGroundedTranscriptSummary,
  DEFAULT_MIN_TRANSCRIPT_TOKENS,
  isMissingTranscript,
  MISSING_TRANSCRIPT_NOTICE,
} from '../src/summarize/missing-transcript'

describe('isMissingTranscript', () => {
  it('treats a description-only transcript as missing regardless of length', () => {
    expect(isMissingTranscript({ usedDescription: true, transcriptText: 'anything' })).toBe(true)
  })

  it('treats a captioned transcript below the threshold as missing', () => {
    expect(isMissingTranscript({ usedDescription: false, transcriptText: 'short' })).toBe(true)
  })

  it('accepts a captioned transcript at or above the threshold', () => {
    expect(isMissingTranscript({ usedDescription: false, transcriptText: 'word '.repeat(60) })).toBe(false)
  })

  it('disables the size check when the threshold is non-positive', () => {
    expect(isMissingTranscript({ usedDescription: false, transcriptText: 'short' }, 0)).toBe(false)
  })

  it('uses the documented default threshold', () => {
    expect(DEFAULT_MIN_TRANSCRIPT_TOKENS).toBe(40)
  })
})

describe('buildGroundedTranscriptSummary', () => {
  const descriptionOnly = {
    title: 'My Video',
    usedDescription: true,
    transcriptText: 'the video description',
    descriptionText: 'the video description',
  }

  it('starts with the Chinese notice and restates the description', () => {
    const out = buildGroundedTranscriptSummary(descriptionOnly, { outputLanguage: 'zh-CN' })
    expect(out.startsWith(MISSING_TRANSCRIPT_NOTICE.zh)).toBe(true)
    expect(out).toContain('the video description')
  })

  it('uses the English notice for English output', () => {
    const out = buildGroundedTranscriptSummary(descriptionOnly, { outputLanguage: 'en-US' })
    expect(out.startsWith(MISSING_TRANSCRIPT_NOTICE.en)).toBe(true)
    expect(out).toContain('the video description')
  })

  it('never emits chapter headings', () => {
    const out = buildGroundedTranscriptSummary(descriptionOnly, { outputLanguage: 'zh-CN' })
    expect(out).not.toMatch(/### \[/)
  })

  it('falls back to the thin transcript text when there is no description', () => {
    const out = buildGroundedTranscriptSummary({
      title: 'No description',
      usedDescription: false,
      transcriptText: 'thin captions',
    })
    expect(out).toContain('thin captions')
    expect(out).not.toMatch(/### \[/)
  })
})
