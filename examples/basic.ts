/**
 * Minimal usage example.
 *
 *   cp .env.example .env   # fill in your keys
 *   npm run example
 */
import { createVideoSummarizer, consoleLogger } from '../src/index'

const summarizer = createVideoSummarizer({
  llm: {
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
    model: process.env.OPENAI_COMPATIBLE_MODEL ?? 'gpt-3.5-turbo',
  },
  subtitle: {
    savesubsAuthToken: process.env.SAVESUBS_X_AUTH_TOKEN,
    bilibiliSessionTokens: process.env.BILIBILI_SESSION_TOKEN,
  },
  logger: consoleLogger,
})

const input = {
  video: { source: 'youtube' as const, videoId: 'dQw4w9WgXcQ' },
  options: {
    outputLanguage: 'zh-CN',
    sentenceNumber: 5,
    detailLevel: 600,
    outlineLevel: 1,
    showTimestamp: true,
  },
}

// 1. Inspect the extracted transcript (no LLM call).
const transcript = await summarizer.fetchTranscript(input)
console.log('title:', transcript.title)
console.log('transcript:', transcript.transcriptText.slice(0, 200), '...')

// 2. Full, non-streaming summary.
const summary = await summarizer.summarize(input)
console.log('\n--- summary ---\n', summary)

// 3. Streaming (e.g. for an HTTP response).
const stream = await summarizer.summarizeStream(input)
process.stdout.write('\n--- stream ---\n')
for await (const chunk of stream) {
  process.stdout.write(chunk)
}
process.stdout.write('\n')
