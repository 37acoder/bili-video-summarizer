import type { Logger } from '../types'

export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

/** A minimal console logger. */
export const consoleLogger: Logger = {
  debug: (...args) => console.debug('[video-summarizer]', ...args),
  info: (...args) => console.info('[video-summarizer]', ...args),
  warn: (...args) => console.warn('[video-summarizer]', ...args),
  error: (...args) => console.error('[video-summarizer]', ...args),
}
