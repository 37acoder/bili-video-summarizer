import type { LocalTranscriptionOptions } from './types'
export type { LocalTranscriptionOptions, LocalModel, AsrTool } from './types'
export async function doctorLocalTranscription(options?: LocalTranscriptionOptions) {
  return (await import('./environment')).doctorLocalTranscription(options)
}
export async function setupLocalTranscription(options?: LocalTranscriptionOptions) {
  return (await import('./environment')).setupLocalTranscription(options)
}
