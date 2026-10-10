import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/** Structural evidence checks; semantic support still requires reading the cited items. */
export async function verifySummary(manifestPath: string, summaryPath: string, chaptersPath: string) {
  const directory = dirname(resolve(manifestPath))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.version !== 1 || !Array.isArray(manifest.chunks)) throw new Error('INVALID_MANIFEST')
  const items = new Map<number, { s?: number; text: string }>()
  const notes: Array<{ file: string; text: string }> = []
  for (const chunk of manifest.chunks) {
    if (!/^chunks\/\d+\.json$/.test(chunk.file) || !/^maps\/\d+\.md$/.test(chunk.mapFile)) throw new Error('INVALID_MANIFEST')
    const data = JSON.parse(await readFile(resolve(directory, chunk.file), 'utf8'))
    for (const item of data.items) items.set(item.index, item)
    if (manifest.chunkCount > 1) notes.push({ file: chunk.mapFile, text: await readFile(resolve(directory, chunk.mapFile), 'utf8') })
  }
  const summary = await readFile(summaryPath, 'utf8')
  const raw = JSON.parse(await readFile(chaptersPath, 'utf8'))
  const chapters = Array.isArray(raw) ? raw : raw.chapters
  if (!Array.isArray(chapters)) throw new Error('INVALID_CHAPTERS')
  const headings = [...summary.matchAll(/^#{2,3}\s+\[(\d+:\d+(?::\d+)?)\]\s+(.+)$/gm)]
  const problems: Array<{ chapter?: number; file?: string; reason: string }> = []
  if (summary.split(/\r?\n/)[0] !== '# ' + manifest.title) problems.push({ reason: 'TITLE_MISMATCH' })
  if (!headings.length || headings.length !== chapters.length) problems.push({ reason: 'CHAPTER_COUNT_MISMATCH' })
  for (const [index, heading] of headings.entries()) {
    const chapter = chapters[index], item = items.get(chapter?.sourceItemIndex)
    const seconds = heading[1]!.split(':').reduce((total, n) => total * 60 + Number(n), 0)
    if (!chapter || chapter.heading !== heading[2]!.trim() || !Number.isInteger(chapter.sourceItemIndex) ||
      !Number.isFinite(chapter.sourceStartSeconds) || chapter.sourceStartSeconds !== item?.s ||
      typeof chapter.sourceQuote !== 'string' || !chapter.sourceQuote.trim() || !item?.text.includes(chapter.sourceQuote) ||
      Math.floor(chapter.sourceStartSeconds) !== seconds) {
      problems.push({ chapter: index + 1, reason: 'CHAPTER_SOURCE_MISMATCH' }); continue
    }
    const body = summary.slice(heading.index! + heading[0].length, headings[index + 1]?.index ?? summary.length)
    const depth = heading[0].match(/^#+/)![0].length
    const section = body.split(new RegExp('^#{1,' + depth + '}\\s+', 'm'))[0] ?? ''
    // Item ranges in the prose expose late anchors that a valid sidecar quote
    // alone cannot catch. Unreferenced prose still needs semantic review.
    const cited = [...section.matchAll(/\bitems?\s+(\d+)/g)].map(match => items.get(Number(match[1]))?.s).filter((s): s is number => s !== undefined)
    if (cited.some(s => chapter.sourceStartSeconds > s)) problems.push({ chapter: index + 1, reason: 'CHAPTER_START_AFTER_CITED_CONTENT' })
  }
  for (const note of [...notes, { file: summaryPath, text: summary }]) {
    if (/应为|正确是/.test(note.text)) problems.push({ file: note.file, reason: 'CORRECTION_REQUIRES_REVIEW' })
  }
  return { valid: problems.length === 0, chapterCount: headings.length, problems,
    limitation: 'Source identity and chronology checks do not establish semantic support or transcription accuracy' }
}
