/**
 * Transcript size limiting.
 *
 * Ported from BibiGPT-v1 `lib/openai/getSmallSizeTranscripts.ts`.
 *
 * Original algorithm: Copyright (c) 2022 Kazuki Nakayashiki.
 * Modified work: Copyright (c) 2023 Qixiang Zhu.
 * Released under the MIT License (see the upstream project for the full text).
 *
 * When the transcript exceeds the byte budget, this implementation does NOT
 * summarize hierarchically; it randomly drops half of the lines and recurses
 * until the text fits, then re-adds lines until the budget is reached. It is a
 * cheap way to stay inside the prompt window, at the cost of losing content.
 *
 * Deviation from upstream: BibiGPT's expansion loop kept appending lines after
 * the budget was exceeded (a no-op truncation that could return nearly the full
 * transcript). This port stops filling once the budget is reached and enforces
 * the limit as a hard cap, so the returned text is guaranteed to fit.
 */
import type { CommonSubtitleItem } from '../types'

/** Default byte budget for a transcript (2_000 bytes under a ~15_000 budget). */
export const DEFAULT_TRANSCRIPT_BYTE_LIMIT = 6200

/** UTF-8 byte length of a string. */
export function getByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/** Truncate a string so its UTF-8 byte length is at most `byteLimit`. */
export function limitTranscriptByteLength(str: string, byteLimit: number = DEFAULT_TRANSCRIPT_BYTE_LIMIT): string {
  const byteLength = getByteLength(str)
  if (byteLength > byteLimit) {
    const ratio = byteLimit / byteLength
    return str.substring(0, Math.floor(str.length * ratio))
  }
  return str
}

/** Remove roughly half of the elements, chosen at random. */
function filterHalfRandomly<T>(arr: T[]): T[] {
  const filteredArr: T[] = []
  const halfLength = Math.floor(arr.length / 2)
  const indicesToFilter = new Set<number>()

  while (indicesToFilter.size < halfLength) {
    const index = Math.floor(Math.random() * arr.length)
    indicesToFilter.add(index)
  }

  for (let i = 0; i < arr.length; i++) {
    if (!indicesToFilter.has(i)) {
      filteredArr.push(arr[i] as T)
    }
  }

  return filteredArr
}

type SubtitleItem = Pick<CommonSubtitleItem, 'text' | 'index'>

function itemInIt(textData: SubtitleItem[], text: string): boolean {
  return textData.find((t) => t.text === text) !== undefined
}

/**
 * Collapse subtitle items into a single transcript string that fits the byte
 * budget, preserving chronological order.
 */
export function getSmallSizeTranscripts(
  newTextData: SubtitleItem[],
  oldTextData: SubtitleItem[],
  byteLimit: number = DEFAULT_TRANSCRIPT_BYTE_LIMIT,
): string {
  const text = newTextData
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')
  const byteLength = getByteLength(text)

  if (byteLength > byteLimit) {
    const filteredData = filterHalfRandomly(newTextData)
    return getSmallSizeTranscripts(filteredData, oldTextData, byteLimit)
  }

  const resultData: SubtitleItem[] = newTextData.slice()
  let lastByteLength = byteLength

  for (let i = 0; i < oldTextData.length; i++) {
    const obj = oldTextData[i] as SubtitleItem
    if (itemInIt(newTextData, obj.text)) {
      continue
    }

    const nextTextByteLength = getByteLength(obj.text)
    const remaining = byteLimit - lastByteLength

    if (remaining <= 0) {
      break
    }

    if (nextTextByteLength > remaining) {
      // Fill the remaining budget with the leading part of this line, then stop.
      const keepChars = Math.floor(obj.text.length * (remaining / nextTextByteLength))
      if (keepChars > 0) {
        resultData.push({ text: obj.text.substring(0, keepChars), index: obj.index })
      }
      break
    }

    resultData.push(obj)
    // +1 for the joining space.
    lastByteLength += nextTextByteLength + 1
  }

  const resultText = resultData
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((t) => t.text)
    .join(' ')

  // Hard guarantee, also covers the multibyte approximation above.
  return limitTranscriptByteLength(resultText, byteLimit)
}
