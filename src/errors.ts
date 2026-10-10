/** Error raised by the summarization pipeline, carrying an HTTP-ish status code. */
export type SummarizeErrorCode = 'NO_VIDEO_ID' | 'NO_TRANSCRIPT' | 'MISSING_API_KEY' | 'UPSTREAM' | 'UNKNOWN'

export class SummarizeError extends Error {
  readonly statusCode: number
  readonly code: SummarizeErrorCode

  constructor(statusCode: number, code: SummarizeErrorCode, message: string) {
    super(message)
    this.name = 'SummarizeError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function isSummarizeError(error: unknown): error is SummarizeError {
  return error instanceof SummarizeError
}
