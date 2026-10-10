import { describe, expect, it, vi } from 'vitest'
import { createVideoSummarizer } from '../src/summarizer'
import { SummarizeError } from '../src/errors'
import { getByteLength } from '../src/transcript/small-size-transcripts'
import type { FetchLike, LlmClient, TranscriptResult } from '../src/types'

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
}

type Route = { match: (url: string) => boolean; handler: () => Response }

function makeFetch(routes: Route[]): FetchLike {
  return (async (input: Parameters<FetchLike>[0]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    for (const route of routes) {
      if (route.match(url)) {
        return route.handler()
      }
    }
    throw new Error(`unexpected fetch: ${url}`)
  }) as FetchLike
}

function fakeLlm(text = '## Summary\n- first bullet'): LlmClient & { generate: ReturnType<typeof vi.fn> } {
  return {
    generate: vi.fn(async () => text),
    async stream() {
      return (async function* () {
        yield '## Summary\n'
        yield '- streamed bullet'
      })()
    },
  }
}

const youtubeRoutes: Route[] = [
  {
    match: (url) => url.includes('/action/extract'),
    handler: () =>
      jsonResponse({
        response: { title: 'Demo Video', formats: [{ quality: 'English', url: '/sub/1' }] },
      }),
  },
  {
    match: (url) => url.includes('/sub/1') && url.includes('ext=txt'),
    // Long enough (well over the default min-transcript threshold) that these
    // plumbing tests exercise the normal caption-backed outline path.
    handler: () =>
      new Response(
        [
          'para one introduces the demo video and states the central question',
          'para two explains the background and defines the key terms used later',
          'para three walks through the first example with concrete numbers',
          'para four covers the second example and the common mistakes to avoid',
          'para five summarises the conclusion and lists the actionable takeaways',
        ].join('\r\n\r\n'),
      ),
  },
]

describe('createVideoSummarizer', () => {
  it('extracts a transcript without calling the LLM', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(youtubeRoutes) })

    const transcript = await summarizer.fetchTranscript({
      video: { source: 'youtube', videoId: 'abc' },
    })

    expect(transcript.title).toBe('Demo Video')
    expect(transcript.usedDescription).toBe(false)
    expect(transcript.transcriptText).toContain('para one')
    expect(llm.generate).not.toHaveBeenCalled()
  })

  it('summarizes and caches the result', async () => {
    const llm = fakeLlm('the summary')
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(youtubeRoutes) })

    const input = { video: { source: 'youtube' as const, videoId: 'abc' }, options: { sentenceNumber: 5 } }
    const first = await summarizer.summarize(input)
    const second = await summarizer.summarize(input)

    expect(first).toBe('the summary')
    expect(second).toBe('the summary')
    expect(llm.generate).toHaveBeenCalledTimes(1)
  })

  it('can disable caching with cache: false', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(youtubeRoutes), cache: false })

    const input = { video: { source: 'youtube' as const, videoId: 'abc' } }
    await summarizer.summarize(input)
    await summarizer.summarize(input)
    expect(llm.generate).toHaveBeenCalledTimes(2)
  })

  it('streams and caches the concatenated result', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(youtubeRoutes) })
    const input = { video: { source: 'youtube' as const, videoId: 'xyz' } }

    let out = ''
    for await (const chunk of await summarizer.summarizeStream(input)) {
      out += chunk
    }
    expect(out).toBe('## Summary\n- streamed bullet')

    // Second stream is served from cache in a single chunk.
    let cached = ''
    for await (const chunk of await summarizer.summarizeStream(input)) {
      cached += chunk
    }
    expect(cached).toBe(out)
  })

  it('throws a SummarizeError when there are no captions', async () => {
    const llm = fakeLlm()
    const routes: Route[] = [
      { match: (url) => url.includes('/action/extract'), handler: () => jsonResponse({ response: { title: 'x', formats: [] } }) },
    ]
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(routes) })

    await expect(summarizer.buildPrompt({ video: { source: 'youtube', videoId: 'no-subs' } })).rejects.toBeInstanceOf(
      SummarizeError,
    )
  })

  it('keeps the whole transcript instead of randomly dropping lines', async () => {
    const llm = fakeLlm()
    const paragraphs = Array.from({ length: 600 }, (_, i) => `句子${i}内容`).join('\r\n\r\n')
    const routes: Route[] = [
      {
        match: (url) => url.includes('/action/extract'),
        handler: () => jsonResponse({ response: { title: 'Long', formats: [{ quality: 'English', url: '/sub/long' }] } }),
      },
      {
        match: (url) => url.includes('/sub/long') && url.includes('ext=txt'),
        handler: () => new Response(paragraphs),
      },
    ]
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(routes) })

    const transcript = await summarizer.fetchTranscript({ video: { source: 'youtube', videoId: 'long' } })
    expect(getByteLength(transcript.transcriptText)).toBeGreaterThan(6200)
    expect(transcript.transcriptText).toContain('句子0内容')
    expect(transcript.transcriptText).toContain('句子599内容')
  })

  it('summarizes long transcripts with map-reduce (multiple LLM calls)', async () => {
    const llm = fakeLlm('merged summary')
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })
    const groups = Array.from({ length: 30 }, (_, i) => ({ text: `第${i}段`.padEnd(300, '字'), index: i }))
    const transcript = {
      title: '长视频',
      videoId: 'long',
      source: 'bilibili' as const,
      subtitlesArray: groups,
      transcriptText: groups.map((g) => g.text).join(' '),
      usedDescription: false,
    }

    const summary = await summarizer.summarize({
      video: { source: 'bilibili', videoId: 'long' },
      options: { model: 'gpt-3.5-turbo' }, // 16k window => the 30-group transcript needs >1 segment
      transcript,
    })

    expect(summary).toBe('merged summary')
    // At least 2 map calls plus 1 reduce call.
    expect(llm.generate.mock.calls.length).toBeGreaterThan(2)
  })

  it('reports the map-reduce plan from buildPrompt', async () => {
    const summarizer = createVideoSummarizer({ llmClient: fakeLlm(), cache: false })
    const groups = Array.from({ length: 30 }, (_, i) => ({ text: `第${i}段`.padEnd(300, '字'), index: i }))
    const transcript = {
      title: '长视频',
      videoId: 'long',
      source: 'bilibili' as const,
      subtitlesArray: groups,
      transcriptText: groups.map((g) => g.text).join(' '),
      usedDescription: false,
    }

    const built = await summarizer.buildPrompt({
      video: { source: 'bilibili', videoId: 'long' },
      options: { model: 'gpt-3.5-turbo' },
      transcript,
    })

    expect(built.chunks).toBe(2)
    expect(built.stages?.map((s) => s.kind)).toEqual(['map', 'map'])
    expect(built.prompt).toContain('Segment: 1/2')
  })

  it('disables the reasoning phase by default for deepseek-flash', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(youtubeRoutes), cache: false })

    await summarizer.summarize({ video: { source: 'youtube', videoId: 'flash' } })

    expect(llm.generate.mock.calls[0]?.[0]).toMatchObject({ model: 'deepseek-flash', reasoningEffort: 'none' })
  })

  it('lets callers override the reasoning effort and leaves other models unset', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(youtubeRoutes), cache: false })

    await summarizer.summarize({
      video: { source: 'youtube', videoId: 'o1' },
      options: { model: 'gpt-4o', reasoningEffort: 'high' },
    })
    await summarizer.summarize({
      video: { source: 'youtube', videoId: 'o2' },
      options: { model: 'gpt-4o' },
    })

    expect(llm.generate.mock.calls[0]?.[0]).toMatchObject({ model: 'gpt-4o', reasoningEffort: 'high' })
    expect(llm.generate.mock.calls[1]?.[0]?.reasoningEffort).toBeUndefined()
  })

  it('extracts Bilibili captions through the official APIs', async () => {
    const llm = fakeLlm()
    const routes: Route[] = [
      {
        match: (url) => url.includes('/x/web-interface/view'),
        handler: () =>
          jsonResponse({ data: { title: 'Bili', desc: 'desc', dynamic: 'dyn', aid: 1, pages: [{ page: 1, cid: 2 }] } }),
      },
      {
        match: (url) => url.includes('/x/player/v2'),
        handler: () => jsonResponse({ data: { subtitle: { subtitles: [{ lan: 'zh-CN', subtitle_url: '//x/sub.json' }] } } }),
      },
      {
        match: (url) => url.includes('x/sub.json'),
        handler: () => jsonResponse({ body: [{ from: 0, content: '你好' }, { from: 1, content: '世界' }] }),
      },
    ]
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(routes) })

    const transcript = await summarizer.fetchTranscript({ video: { source: 'bilibili', videoId: 'BV1xx' } })
    expect(transcript.title).toBe('Bili')
    expect(transcript.transcriptText).toContain('你好')
    expect(transcript.transcriptText).toContain('世界')
  })

  it('retries when the Bilibili subtitle file does not match the video duration', async () => {
    const llm = fakeLlm()
    let playerCall = 0
    const routes: Route[] = [
      {
        match: (url) => url.includes('/x/web-interface/view'),
        handler: () =>
          jsonResponse({
            data: { title: 'Bili', desc: 'desc', aid: 1, duration: 10, pages: [{ page: 1, cid: 2, duration: 10 }] },
          }),
      },
      {
        match: (url) => url.includes('/x/player/v2'),
        handler: () => {
          playerCall += 1
          const subtitleUrl = playerCall === 1 ? '//x/bad.json' : '//x/good.json'
          return jsonResponse({ data: { subtitle: { subtitles: [{ lan: 'zh-CN', subtitle_url: subtitleUrl }] } } })
        },
      },
      {
        match: (url) => url.includes('x/bad.json'),
        handler: () => jsonResponse({ body: [{ from: 0, content: '别的视频内容' }, { from: 999, content: '尾声' }] }),
      },
      {
        match: (url) => url.includes('x/good.json'),
        handler: () => jsonResponse({ body: [{ from: 0, content: '你好' }, { from: 9, content: '世界' }] }),
      },
    ]
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(routes) })

    const transcript = await summarizer.fetchTranscript({ video: { source: 'bilibili', videoId: 'BV1xx' } })
    expect(transcript.usedDescription).toBe(false)
    expect(transcript.transcriptText).toContain('你好')
    expect(transcript.transcriptText).not.toContain('别的视频内容')
  })

  it('degrades to the description when every subtitle file mismatches the video duration', async () => {
    const llm = fakeLlm()
    const routes: Route[] = [
      {
        match: (url) => url.includes('/x/web-interface/view'),
        handler: () =>
          jsonResponse({
            data: { title: 'Bili', desc: 'the description', aid: 1, duration: 10, pages: [{ page: 1, cid: 2, duration: 10 }] },
          }),
      },
      {
        match: (url) => url.includes('/x/player/v2'),
        handler: () => jsonResponse({ data: { subtitle: { subtitles: [{ lan: 'zh-CN', subtitle_url: '//x/bad.json' }] } } }),
      },
      {
        match: (url) => url.includes('x/bad.json'),
        handler: () => jsonResponse({ body: [{ from: 0, content: '别的视频内容' }, { from: 999, content: '尾声' }] }),
      },
    ]
    const summarizer = createVideoSummarizer({ llmClient: llm, fetch: makeFetch(routes) })

    const transcript = await summarizer.fetchTranscript({ video: { source: 'bilibili', videoId: 'BV1xx' } })
    expect(transcript.usedDescription).toBe(true)
    expect(transcript.transcriptText).toBe('the description')
    expect(transcript.transcriptText).not.toContain('别的视频内容')
  })
})

describe('missing transcript handling', () => {
  const descriptionOnly: TranscriptResult = {
    title: '如何在中国合法造一把属于自己的枪',
    videoId: 'BV1xx',
    source: 'bilibili',
    subtitlesArray: null,
    descriptionText: '一条很短的简介。',
    transcriptText: '一条很短的简介。',
    usedDescription: true,
  }

  const captionBacked: TranscriptResult = {
    title: 'A substantial talk',
    videoId: 'vid',
    source: 'youtube',
    subtitlesArray: [
      { text: 'This is a substantial caption track.', index: 0 },
      { text: 'It runs for a while and contains several sentences of real content.', index: 1 },
      { text: 'The estimated token count stays well above the default threshold.', index: 2 },
    ],
    transcriptText:
      'This is a substantial caption track. It runs for a while and contains several sentences of real content. The estimated token count stays well above the default threshold.',
    usedDescription: false,
  }

  const thinCaptions: TranscriptResult = {
    ...captionBacked,
    subtitlesArray: [{ text: 'tiny', index: 0 }],
    transcriptText: 'tiny',
  }

  it('throws NO_TRANSCRIPT by default for a description-only transcript', async () => {
    const llm = fakeLlm('## 一句话总结\n### [00:00] 编造的章节')
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })

    await expect(
      summarizer.summarize({ video: { source: 'bilibili', videoId: 'BV1xx' }, transcript: descriptionOnly }),
    ).rejects.toMatchObject({ code: 'NO_TRANSCRIPT', statusCode: 501 })
    expect(llm.generate).not.toHaveBeenCalled()
  })

  it('throws NO_TRANSCRIPT by default for a below-threshold captioned transcript', async () => {
    const summarizer = createVideoSummarizer({ llmClient: fakeLlm(), cache: false })

    await expect(
      summarizer.summarize({
        video: { source: 'bilibili', videoId: 'thin' },
        options: { minTranscriptTokens: 100 },
        transcript: thinCaptions,
      }),
    ).rejects.toMatchObject({ code: 'NO_TRANSCRIPT', statusCode: 501 })
  })

  it("still supports 'degrade' as an explicit per-request opt-in", async () => {
    const llm = fakeLlm('## 一句话总结\n### [00:00] 编造的章节')
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })

    const summary = await summarizer.summarize({
      video: { source: 'bilibili', videoId: 'BV1xx' },
      options: { onMissingTranscript: 'degrade' },
      transcript: descriptionOnly,
    })

    expect(summary).toContain('未获取到字幕')
    expect(summary).toContain('一条很短的简介')
    expect(summary).not.toMatch(/### \[/m)
    expect(llm.generate).not.toHaveBeenCalled()
  })

  it('localises the grounded notice for English output', async () => {
    const summarizer = createVideoSummarizer({ llmClient: fakeLlm(), cache: false })

    const summary = await summarizer.summarize({
      video: { source: 'bilibili', videoId: 'BV1xx' },
      options: { outputLanguage: 'en-US', onMissingTranscript: 'degrade' },
      transcript: descriptionOnly,
    })

    expect(summary).toContain('No captions were available')
    expect(summary).not.toMatch(/### \[/m)
  })

  it('streams the grounded summary when degrade is opted into', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })

    let out = ''
    for await (const chunk of await summarizer.summarizeStream({
      video: { source: 'bilibili', videoId: 'BV1xx' },
      options: { onMissingTranscript: 'degrade' },
      transcript: descriptionOnly,
    })) {
      out += chunk
    }

    expect(out).toContain('未获取到字幕')
    expect(out).not.toMatch(/### \[/m)
    expect(llm.generate).not.toHaveBeenCalled()
  })

  it('honours the summarizer-level onMissingTranscript default', async () => {
    const summarizer = createVideoSummarizer({
      llmClient: fakeLlm(),
      cache: false,
      onMissingTranscript: 'degrade',
    })

    const summary = await summarizer.summarize({
      video: { source: 'bilibili', videoId: 'BV1xx' },
      transcript: descriptionOnly,
    })
    expect(summary).toContain('未获取到字幕')
  })

  it("throws for a below-threshold transcript when the summarizer default is 'throw'", async () => {
    const summarizer = createVideoSummarizer({
      llmClient: fakeLlm(),
      cache: false,
      onMissingTranscript: 'throw',
    })

    await expect(
      summarizer.summarize({ video: { source: 'youtube', videoId: 'thin' }, transcript: thinCaptions }),
    ).rejects.toMatchObject({ code: 'NO_TRANSCRIPT' })
  })

  it('makes the thin-transcript threshold configurable', async () => {
    const llm = fakeLlm('the outline')
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })

    const degraded = await summarizer.summarize({
      video: { source: 'youtube', videoId: 'thin' },
      options: { minTranscriptTokens: 100, onMissingTranscript: 'degrade' },
      transcript: thinCaptions,
    })
    expect(degraded).toContain('未获取到字幕')

    const withSizeCheckDisabled = await summarizer.summarize({
      video: { source: 'youtube', videoId: 'thin' },
      options: { minTranscriptTokens: 0 },
      transcript: thinCaptions,
    })
    expect(withSizeCheckDisabled).toBe('the outline')
    expect(llm.generate).toHaveBeenCalledTimes(1)
  })

  it('still produces the chaptered outline for a caption-backed video', async () => {
    const llm = fakeLlm('## 一句话总结\n### [00:12] 章节')
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })

    const summary = await summarizer.summarize({
      video: { source: 'youtube', videoId: 'vid' },
      transcript: captionBacked,
    })

    expect(summary).toContain('### [00:12]')
    expect(llm.generate).toHaveBeenCalledTimes(1)
  })

  it('exposes a grounded stage from buildPrompt without calling the LLM', async () => {
    const llm = fakeLlm()
    const summarizer = createVideoSummarizer({ llmClient: llm, cache: false })

    const built = await summarizer.buildPrompt({
      video: { source: 'bilibili', videoId: 'BV1xx' },
      options: { onMissingTranscript: 'degrade' },
      transcript: descriptionOnly,
    })

    expect(built.stages?.map((stage) => stage.kind)).toEqual(['grounded'])
    expect(built.prompt).toContain('未获取到字幕')
    expect(llm.generate).not.toHaveBeenCalled()
  })
})
