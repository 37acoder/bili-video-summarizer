import { describe, expect, it, vi } from 'vitest'
import { createVideoSummarizer } from '../src/summarizer'
import { SummarizeError } from '../src/errors'
import type { FetchLike, LlmClient } from '../src/types'

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
    handler: () => new Response('para one\r\n\r\npara two\r\n\r\npara three'),
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
})
