/**
 * Token estimation.
 *
 * Subtitles are fed to an OpenAI-compatible LLM, so the map-reduce chunker needs
 * a token count *before* the request is sent. There is no tokenizer dependency
 * here (the module stays framework-free), so this is a deliberate, documented
 * approximation:
 *
 * - CJK / full-width characters: 1 token each. This over-estimates the real
 *   ratio (Chinese is typically ~0.6 token/char), so the estimate is
 *   conservative: it never underestimates Chinese text and therefore never lets
 *   a chunk overflow the context window.
 * - Everything else: ~4 characters per token.
 *
 * Erring high is safe (more/smaller chunks); erring low risks an upstream
 * `context_length_exceeded` error.
 */

/** Whether a code point is CJK / full-width, counted at one token per char. */
function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) || // CJK radicals … unified ideographs
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility ideographs
    (codePoint >= 0xff00 && codePoint <= 0xffef) || // full-width forms
    (codePoint >= 0x20000 && codePoint <= 0x2ffff) // CJK extension B+
  )
}

/** Conservative token estimate for `text`. */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0
  }
  let wide = 0
  let narrow = 0
  for (const char of text) {
    if (isWideCodePoint(char.codePointAt(0) ?? 0)) {
      wide += 1
    } else {
      narrow += 1
    }
  }
  return Math.ceil(wide + narrow / 4)
}
