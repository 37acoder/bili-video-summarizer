/** Reads `process.env` without assuming a Node global exists (browser-safe). */
export function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined
  }
  return process.env[key]
}
