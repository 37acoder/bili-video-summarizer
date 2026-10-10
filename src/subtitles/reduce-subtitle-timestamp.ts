/**
 * Reduce a raw caption list into chronological groups.
 *
 * Ported from BibiGPT-v1 `utils/reduceSubtitleTimestamp.ts`. Caption lines are
 * batched into ~30 groups (or 7 lines per group for short videos). When
 * `showTimestamp` is set, each group is prefixed with its start time.
 */
import type { CommonSubtitleItem } from '../types'

export type YoutubeSubtitleItem = { start: number; lines: string[] }
export type BilibiliSubtitleItem = { from: number; content: string }

export function reduceSubtitleTimestamp<T>(
  subtitles: Array<T> = [],
  getStart: (item: T) => number,
  getText: (item: T) => string,
  shouldShowTimestamp?: boolean,
): CommonSubtitleItem[] {
  // Aim for ~30 groups; fall back to 7 lines per group for short videos.
  const TOTAL_GROUP_COUNT = 30
  const MINIMUM_COUNT_ONE_GROUP = 7
  void (subtitles.length > TOTAL_GROUP_COUNT
    ? subtitles.length / TOTAL_GROUP_COUNT
    : MINIMUM_COUNT_ONE_GROUP)

  return subtitles.reduce<CommonSubtitleItem[]>((accumulator, current, index) => {
    const groupIndex: number = Math.floor(index / MINIMUM_COUNT_ONE_GROUP)

    if (!accumulator[groupIndex]) {
      accumulator[groupIndex] = {
        index: groupIndex,
        s: getStart(current),
        text: shouldShowTimestamp ? `${getStart(current)} - ` : '',
      }
    }

    const group = accumulator[groupIndex] as CommonSubtitleItem
    group.text = group.text + getText(current) + ' '

    return accumulator
  }, [])
}

export function reduceYoutubeSubtitleTimestamp(subtitles: Array<YoutubeSubtitleItem> = []): CommonSubtitleItem[] {
  return reduceSubtitleTimestamp<YoutubeSubtitleItem>(
    subtitles,
    (i) => i.start,
    (i) => i.lines.join(' '),
    true,
  )
}

export function reduceBilibiliSubtitleTimestamp(
  subtitles: Array<BilibiliSubtitleItem> = [],
  shouldShowTimestamp?: boolean,
): CommonSubtitleItem[] {
  return reduceSubtitleTimestamp<BilibiliSubtitleItem>(
    subtitles,
    (i) => i.from,
    (i) => i.content,
    shouldShowTimestamp,
  )
}
