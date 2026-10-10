export type AsrTool = 'ytDlp' | 'ffmpeg' | 'ffprobe' | 'whisperCli'
export type LocalModel = 'small' | 'medium'
export interface LocalTranscriptionOptions {
  model?: LocalModel
  modelPath?: string
  language?: string
  cacheDir?: string
  configFile?: string
  tools?: Partial<Record<AsrTool, string>>
  signal?: AbortSignal
  onProgress?: (event: { stage: string; status: 'started' | 'complete' | 'cached'; seconds?: number }) => void
}
export interface ResolvedLocalOptions {
  model: LocalModel
  modelPath: string
  language: string
  cacheDir: string
  configFile: string
  tools: Record<AsrTool, string>
}
