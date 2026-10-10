/**
 * Real end-to-end run against a Bilibili video.
 *
 *   set -a; source ./.env; set +a
 *   npx tsx examples/bilibili.ts "https://www.bilibili.com/video/BV1Wmao6JEQy/"
 *
 * Requires OPENAI_COMPATIBLE_* env vars; BILIBILI_SESSION_TOKEN (SESSDATA) is
 * needed to actually read the caption list (otherwise it falls back to the
 * video description).
 */
import { createVideoSummarizer, consoleLogger } from '../src/index'

const url = process.argv[2] ?? 'https://www.bilibili.com/video/BV1Wmao6JEQy/'
const videoId = url.match(/\/video\/([^/?#]+)/)?.[1] ?? url

const summarizer = createVideoSummarizer({
  llm: { model: process.env.OPENAI_COMPATIBLE_MODEL },
  cache: false,
  logger: consoleLogger,
})

const input = {
  video: { source: 'bilibili' as const, videoId },
  options: { outputLanguage: 'zh-CN', sentenceNumber: 5, detailLevel: 600, showTimestamp: true },
}

const transcript = await summarizer.fetchTranscript(input)
console.log('videoId:', videoId)
console.log('title:', transcript.title)
console.log('usedDescription:', transcript.usedDescription, '| subtitle groups:', transcript.subtitlesArray?.length ?? 0)
console.log('transcript:', transcript.transcriptText.slice(0, 400))
console.log('--- summary ---')
// Reuse the transcript so the caption is only extracted once.
console.log(await summarizer.summarize({ ...input, transcript }))
