/**
 * Dump every piece of source information behind a summary, for manual review.
 *
 *   set -a; source ./.env; set +a
 *   npx tsx scripts/dump-source.ts "https://www.bilibili.com/video/BV1KLhi6oEh5/"
 *
 * Writes:  review/<videoId>.md            human-readable report
 *          review/<videoId>.source.json   machine-readable full dump
 */
import { mkdir, writeFile } from 'node:fs/promises'
import {
  buildUserPrompt,
  createVideoSummarizer,
  getByteLength,
  getSmallSizeTranscripts,
  reduceBilibiliSubtitleTimestamp,
  resolveMaxOutputTokens,
  type CommonSubtitleItem,
  type SummarizeOptions,
  type TranscriptResult,
} from '../src/index'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const OPTIONS: SummarizeOptions = {
  outputLanguage: 'zh-CN',
  sentenceNumber: 5,
  detailLevel: 600,
  showTimestamp: true,
}

interface BiliPage {
  page: number
  cid: number
  duration: number
  part?: string
}

function videoIdFromUrl(url: string): string {
  return url.match(/\/video\/([^/?#]+)/)?.[1] ?? url
}

function hhmmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

async function main() {
  const arg = process.argv[2] ?? ''
  const videoId = videoIdFromUrl(arg)
  const sess = process.env.BILIBILI_SESSION_TOKEN ?? ''
  const headers = {
    'User-Agent': UA,
    Referer: `https://www.bilibili.com/video/${videoId}/`,
    Cookie: `SESSDATA=${sess}`,
  }

  // 1. video metadata
  const view = (
    (await (await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`, { headers })).json()) as any
  ).data
  const pages: BiliPage[] = (view.pages ?? []).map((p: any) => ({
    page: p.page,
    cid: p.cid,
    duration: p.duration,
    part: p.part,
  }))
  const page = pages[0] ?? { page: 1, cid: view.cid, duration: view.duration }
  const duration = page.duration ?? view.duration

  // 2. caption list + raw subtitle body, retrying until it matches the duration
  let rawBody: any[] = []
  let chosen: { lan?: string; lan_doc?: string; subtitle_url?: string; listSize?: number } = {}
  let attempt = 0
  const seenLists: number[] = []
  for (attempt = 1; attempt <= 12 && rawBody.length === 0; attempt++) {
    const p2 = (
      (await (
        await fetch(`https://api.bilibili.com/x/player/v2?aid=${view.aid}&cid=${page.cid}`, { headers })
      ).json()) as any
    ).data
    const list = p2?.subtitle?.subtitles ?? []
    seenLists.push(list.length)
    const pick = list.find((s: any) => s.lan === 'zh-CN') || list[0]
    if (!pick?.subtitle_url) continue
    const url = pick.subtitle_url.startsWith('//') ? `https:${pick.subtitle_url}` : pick.subtitle_url
    let body: any[] = []
    try {
      body = ((await (await fetch(url, { headers })).json()) as any).body ?? []
    } catch {
      continue
    }
    if (!body.length) continue
    const lastFrom = body[body.length - 1].from
    const ok = Math.abs(lastFrom - duration) <= Math.max(15, duration * 0.03)
    if (ok) {
      rawBody = body
      chosen = { lan: pick.lan, lan_doc: pick.lan_doc, subtitle_url: url, listSize: list.length }
    }
  }

  // 3. reproduce the pipeline outputs from the raw caption
  const attemptsUsed = rawBody.length ? attempt : attempt - 1
  const subtitlesArray: CommonSubtitleItem[] = reduceBilibiliSubtitleTimestamp(rawBody as any, OPTIONS.showTimestamp)
  const transcriptText = getSmallSizeTranscripts(subtitlesArray, subtitlesArray)
  const transcriptBytes = getByteLength(transcriptText)
  const prompt = buildUserPrompt({
    title: view.title,
    transcript: transcriptText,
    options: OPTIONS,
    transcriptByteLimit: undefined,
  })
  const maxOutputTokens = resolveMaxOutputTokens(OPTIONS, false)

  const transcript: TranscriptResult = {
    title: view.title,
    videoId,
    source: 'bilibili',
    subtitlesArray,
    transcriptText,
    usedDescription: false,
  }

  const summarizer = createVideoSummarizer({
    llm: { model: process.env.OPENAI_COMPATIBLE_MODEL },
    cache: false,
  })
  const summary = await summarizer.summarize({ video: { source: 'bilibili', videoId }, options: OPTIONS, transcript })

  // 4. write outputs
  await mkdir('review', { recursive: true })

  const sourceJson = {
    video: {
      bvid: videoId,
      aid: view.aid,
      title: view.title,
      owner: view.owner?.name,
      tname: view.tname,
      durationSeconds: duration,
      pubdate: view.pubdate,
      pages,
      description: view.desc,
    },
    caption: {
      attemptsUsed,
      listSizesSeen: seenLists,
      chosenLan: chosen.lan,
      chosenLanDoc: chosen.lan_doc,
      subtitleUrlPath: (chosen.subtitle_url ?? '').split('?')[0],
      rawLineCount: rawBody.length,
      rawFirst: rawBody[0],
      rawLast: rawBody[rawBody.length - 1],
    },
    transcript: {
      groupCount: subtitlesArray.length,
      byteLength: transcriptBytes,
      text: transcriptText,
      groups: subtitlesArray,
    },
    llm: {
      provider: 'openai-compatible',
      baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL,
      model: process.env.OPENAI_COMPATIBLE_MODEL,
      maxOutputTokens,
      options: OPTIONS,
    },
    prompt,
    summary,
    rawSubtitle: rawBody,
  }
  await writeFile(`review/${videoId}.source.json`, JSON.stringify(sourceJson, null, 2))

  const lines: string[] = []
  lines.push(`# 源信息 review：${view.title}`)
  lines.push('')
  lines.push(`- bvid: \`${videoId}\`  aid: \`${view.aid}\`  cid: \`${page.cid}\``)
  lines.push(`- UP主: ${view.owner?.name}  分区: ${view.tname || '-'}  时长: ${duration}s (${hhmmss(duration)})`)
  lines.push(`- 发布: ${new Date((view.pubdate ?? 0) * 1000).toISOString()}`)
  lines.push(`- 分P: ${pages.length ? pages.map((p) => `P${p.page}${p.part ? ' ' + p.part : ''} (${p.duration}s)`).join('; ') : '-'}`)
  lines.push('')
  lines.push('## 简介原文')
  lines.push('```')
  lines.push(view.desc || '(空)')
  lines.push('```')
  lines.push('')
  lines.push('## 字幕来源')
  lines.push(`- 选择轨道: \`${chosen.lan}\` (${chosen.lan_doc})`)
  lines.push(`- 字幕文件: \`${(chosen.subtitle_url ?? '').split('?')[0]}\``)
  lines.push(`- 抓取轮次: 第 ${attemptsUsed} 次命中（每次列表条数: ${seenLists.join(', ') || '-'}）`)
  lines.push(`- 原始行数: ${rawBody.length}，校验: 末行 ${rawBody[rawBody.length - 1]?.from}s vs 视频 ${duration}s`)
  lines.push('')
  lines.push('## 入库转录（分组后，即真正送进 Prompt 的文本）')
  lines.push(`- 组数: ${subtitlesArray.length}  字节数: ${transcriptBytes}（上限 6200 字节）`)
  lines.push('')
  lines.push('```')
  lines.push(transcriptText)
  lines.push('```')
  lines.push('')
  lines.push('## LLM 参数')
  lines.push('```json')
  lines.push(JSON.stringify({ baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL, model: process.env.OPENAI_COMPATIBLE_MODEL, maxOutputTokens, options: OPTIONS }, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('## 完整 Prompt')
  lines.push('```')
  lines.push(prompt)
  lines.push('```')
  lines.push('')
  lines.push('## 模型输出（完整）')
  lines.push('```')
  lines.push(summary)
  lines.push('```')
  lines.push('')
  lines.push(`> 原始逐行字幕见 \`review/${videoId}.source.json\` 的 \`rawSubtitle\`。`)
  await writeFile(`review/${videoId}.md`, lines.join('\n'))

  console.log(`videoId=${videoId} title=${view.title}`)
  console.log(`caption lan=${chosen.lan} rawLines=${rawBody.length} groups=${subtitlesArray.length} bytes=${transcriptBytes} attempts=${attemptsUsed}`)
  console.log(`wrote review/${videoId}.md and review/${videoId}.source.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
