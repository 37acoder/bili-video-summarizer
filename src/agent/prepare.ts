import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import type { CommonSubtitleItem, TranscriptResult, VideoRequest } from '../types'
import { estimateTokens } from '../utils/tokens'
import type { TranscriptChunk } from '../transcript/chunk-transcript'
import { isMissingTranscript } from '../summarize/missing-transcript'

export function parseVideo(value: string, source?: string): VideoRequest {
  let id = value
  let page: number | undefined
  if (/^https?:/.test(value)) {
    const url = new URL(value)
    if (/(^|\.)bilibili\.com$/.test(url.hostname)) {
      id = url.pathname.match(/^\/video\/(BV[a-zA-Z0-9]+|av\d+)\/?$/)?.[1] ?? ''
      source = 'bilibili'
      if (url.searchParams.has('p')) page = Number(url.searchParams.get('p'))
    } else if (url.hostname === 'youtu.be') {
      id = url.pathname.slice(1); source = 'youtube'
    } else if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ?? ''
      source = 'youtube'
    } else throw new Error('UNSUPPORTED_URL: use a canonical Bilibili or YouTube video URL')
  }
  source ??= /^(BV|av)/.test(id) ? 'bilibili' : 'youtube'
  if (source !== 'bilibili' && source !== 'youtube') throw new Error('INVALID_SOURCE')
  if (!(source === 'bilibili' ? /^(BV[a-zA-Z0-9]{10}|av\d+)$/.test(id) : /^[a-zA-Z0-9_-]{11}$/.test(id))) {
    throw new Error('INVALID_VIDEO_ID')
  }
  if (page !== undefined && (!Number.isInteger(page) || page < 1)) throw new Error('INVALID_PAGE')
  return { source, videoId: id, ...(page === undefined ? {} : { pageNumber: page }) }
}

export async function localTranscript(path: string, title?: string): Promise<TranscriptResult> {
  const text = await readFile(path, 'utf8')
  if (path.endsWith('.json')) {
    const result = JSON.parse(text)
    if (typeof result.usedDescription !== 'boolean' || typeof result.transcriptText !== 'string' ||
      typeof result.title !== 'string' || !('subtitlesArray' in result)) {
      throw new Error('INVALID_TRANSCRIPT: expected fetchTranscript() JSON')
    }
    return result
  }
  const subtitlesArray = text.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    // Plain text supports [seconds], [mm:ss], [hh:mm:ss], or seconds - text.
    const match = /^(?:\[(\d+(?::\d+){0,2}(?:\.\d+)?)\]\s*|(?=(\d+(?:\.\d+)?)\s+-))/.exec(line)
    const raw = match?.[1] ?? match?.[2]
    const seconds = raw?.split(':').reduce((total, n) => total * 60 + Number(n), 0)
    return { index, text: line, ...(seconds === undefined ? {} : { s: seconds }) }
  })
  return { title: title ?? '用户提供的转录', source: 'bilibili', videoId: 'local',
    usedDescription: false, transcriptText: text, subtitlesArray }
}

export async function prepareArtifacts(transcript: TranscriptResult, out: string, budget: number, provenance: unknown) {
  if (!Number.isInteger(budget) || budget < 128 || budget > 16000) throw new Error('INVALID_CHUNK_BUDGET: use 128..16000')
  if (isMissingTranscript(transcript)) throw new Error('NO_TRANSCRIPT: captions absent or too thin; provide a transcript, not a description')
  const original = transcript.subtitlesArray?.length
    ? transcript.subtitlesArray
    : [{ index: 0, text: transcript.transcriptText }]
  // Reindex and split even a single huge subtitle, so a chunk is truly bounded.
  // A code point costs at most two estimator units; half-budget character slices
  // also avoid quadratic rescanning of pathological one-line transcripts.
  const items: CommonSubtitleItem[] = []
  for (const item of original.slice().sort((a, b) => a.index - b.index)) {
    if (typeof item.text !== 'string') throw new Error('INVALID_SUBTITLE')
    const chars = Array.from(item.text)
    const size = Math.floor(budget / 2)
    for (let start = 0; start < chars.length; start += size) {
      const seconds = item.s === undefined ? undefined : Number(item.s)
      if (seconds !== undefined && (!Number.isFinite(seconds) || seconds < 0)) throw new Error('INVALID_TIMESTAMP')
      items.push({ index: items.length, text: chars.slice(start, start + size).join(''),
        ...(seconds === undefined ? {} : { s: seconds }), ...(item.e === undefined ? {} : { e: item.e }) })
    }
  }
  const chunks: TranscriptChunk[] = []
  let pending: CommonSubtitleItem[] = []
  const encodedTokens = (group: CommonSubtitleItem[]) => estimateTokens(JSON.stringify({ id: '00000000', items: group }, null, 2))
  const flush = () => {
    if (pending.length) chunks.push({ items: pending, text: pending.map(item => item.text).join(' '),
      startIndex: pending[0]!.index, endIndex: pending[pending.length - 1]!.index })
    pending = []
  }
  for (const item of items) {
    if (encodedTokens([...pending, item]) > budget) flush()
    if (encodedTokens([item]) > budget) throw new Error('CHUNK_BUDGET_TOO_SMALL: increase --chunk-tokens')
    pending.push(item)
  }
  flush()
  if (!chunks.length) throw new Error('NO_TRANSCRIPT')
  const directory = resolve(out)
  // A fresh directory prevents mixing a previous video's chunks with this run.
  await mkdir(directory, { recursive: false, mode: 0o700 })
  await mkdir(join(directory, 'chunks'))
  await mkdir(join(directory, 'maps'))
  if (transcript.transcription) {
    await mkdir(join(directory, 'asr'))
    const artifacts = { json: 'asr/whisper.json', srt: 'asr/whisper.srt', text: 'asr/whisper.txt' }
    for (const key of ['json', 'srt', 'text'] as const) await copyFile(transcript.transcription.artifacts[key], join(directory, artifacts[key]))
    transcript = { ...transcript, transcription: { ...transcript.transcription, artifacts } }
    provenance = { kind: 'local-asr', ...transcript.transcription }
  }
  await writeFile(join(directory, 'transcript.json'), JSON.stringify(transcript, null, 2))
  const entries = []
  for (const [i, chunk] of chunks.entries()) {
    const id = String(i + 1).padStart(4, '0')
    const file = `chunks/${id}.json`
    const value = { id, items: chunk.items }
    const body = JSON.stringify(value, null, 2)
    await writeFile(join(directory, file), body)
    entries.push({ id, file, mapFile: `maps/${id}.md`, startIndex: chunk.startIndex, endIndex: chunk.endIndex,
      estimatedTextTokens: estimateTokens(chunk.text), estimatedFileTokens: estimateTokens(body),
      sha256: createHash('sha256').update(body).digest('hex') })
  }
  const manifest = { version: 1, title: transcript.title, provenance, usedDescription: false,
    timestamped: items.every(item => item.s !== undefined), chunkBudget: budget,
    chunkCount: entries.length, itemCount: items.length,
    // Bounded source inspection: each entry identifies one file, never embeds text.
    chunks: entries }
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return { manifest: join(directory, 'manifest.json'), chunkCount: entries.length, usedDescription: false }
}
