import type { ResolvedSubtitleConfig } from '../config'
import type { CommonSubtitleItem, FetchLike, Logger } from '../types'

/** Shared context passed to platform-specific subtitle fetchers. */
export interface SubtitleFetchContext {
  fetch: FetchLike
  config: ResolvedSubtitleConfig
  logger: Logger
}

/** Raw result from a platform fetcher, before transcript size limiting. */
export interface SubtitleFetchResult {
  title: string
  subtitlesArray: CommonSubtitleItem[] | null
  descriptionText?: string
}
