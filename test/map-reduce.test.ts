import { describe, expect, it, vi } from 'vitest'
import {
  summarizeMapReduce,
  summarizeMapReduceStream,
  type MapReduceDeps,
  type MapReduceTranscript,
} from '../src/summarize/map-reduce'
import type { ChatMessage, LlmClient } from '../src/types'

/** Each `w<i>` costs one token, so `maxTokensPerChunk: 2` yields two items per chunk. */
const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `w${i}`, index: i }))

function transcript(subtitlesArray: MapReduceTranscript['subtitlesArray']): MapReduceTranscript {
  return {
    title: 'Demo Video',
    subtitlesArray,
    transcriptText: (subtitlesArray ?? []).map((i) => i.text).join(' '),
  }
}

/** Records every prompt and replies deterministically, tagging map vs reduce calls. */
function recordingLlm(onCall?: (index: number, prompt: string) => string) {
  const prompts: string[] = []
  let calls = 0
  let mapN = 0
  let reduceN = 0
  const generate = vi.fn(async ({ messages }: { messages: ChatMessage[] }) => {
    const prompt = messages[0]?.content ?? ''
    prompts.push(prompt)
    const index = calls++
    if (onCall) return onCall(index, prompt)
    return prompt.includes('已累积') ? `red-${reduceN++}` : `map-${mapN++}`
  })
  const stream = vi.fn(async ({ messages }: { messages: ChatMessage[] }) => {
    const prompt = messages[0]?.content ?? ''
    prompts.push(prompt)
    const index = calls++
    const text = onCall ? onCall(index, prompt) : prompt.includes('已累积') ? `red-${reduceN++}` : `map-${mapN++}`
    return (async function* () {
      yield text
    })()
  })
  const client: LlmClient = { generate, stream }
  return { client, prompts, generate, stream }
}

function deps(llm: LlmClient, overrides: Partial<MapReduceDeps> = {}): MapReduceDeps {
  return { llm, maxOutputTokens: 600, contextWindow: 1_048_576, ...overrides }
}

describe('summarizeMapReduce', () => {
  it('summarizes a short transcript in a single map call (no reduce)', async () => {
    const { client, generate, prompts } = recordingLlm()
    const result = await summarizeMapReduce(transcript([{ text: '只有一句', index: 0 }]), deps(client))

    expect(result.chunks).toBe(1)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(result.summary).toBe('map-0')
    // The single-chunk path uses the final template, not the segment template.
    expect(prompts[0]).toContain('Title: "Demo Video"')
    expect(prompts[0]).not.toContain('已累积')
  })

  it('maps each chunk then reduces with accumulated context and seam subtitles', async () => {
    const { client, prompts, generate } = recordingLlm()
    const result = await summarizeMapReduce(
      transcript(makeItems(6)),
      deps(client, { contextWindow: 4, reserveTokens: 0 }),
    )

    // 3 chunks => 3 map calls + 2 reduce calls.
    expect(result.chunks).toBe(3)
    expect(generate).toHaveBeenCalledTimes(5)
    expect(result.summary).toBe('red-1')
    expect(result.mapSummaries).toEqual(['map-0', 'map-1', 'map-2'])

    const reducePrompts = prompts.filter((p) => p.includes('已累积'))
    expect(reducePrompts).toHaveLength(2)

    const firstReduce = reducePrompts[0]!
    expect(firstReduce).toContain('map-0') // carried accumulated summary
    expect(firstReduce).toContain('map-1') // current segment summary
    expect(firstReduce).toContain('w1') // seam raw subtitle (tail of chunk 0)
    expect(firstReduce).toContain('w2') // seam raw subtitle (head of chunk 1)

    const secondReduce = reducePrompts[1]!
    expect(secondReduce).toContain('red-0') // accumulated from the previous reduce
    expect(secondReduce).toContain('map-2')
  })

  it('degrades gracefully by skipping a failed segment', async () => {
    const { client, generate } = recordingLlm((index, prompt) => {
      if (index === 1) throw new Error('segment 2 exploded')
      return prompt.includes('已累积') ? 'merged' : `map-${index}`
    })
    const result = await summarizeMapReduce(
      transcript(makeItems(6)),
      deps(client, { contextWindow: 4, reserveTokens: 0 }),
    )

    expect(generate).toHaveBeenCalledTimes(4) // 3 map attempts + 1 reduce
    expect(result.mapSummaries).toEqual(['map-0', null, 'map-2'])
    expect(result.summary).toBe('merged')
  })

  it('throws when every segment fails', async () => {
    const { client } = recordingLlm(() => {
      throw new Error('all dead')
    })
    await expect(
      summarizeMapReduce(transcript(makeItems(4)), deps(client, { contextWindow: 4, reserveTokens: 0 })),
    ).rejects.toThrow('all dead')
  })

  it('falls back to transcriptText when there are no subtitle groups', async () => {
    const { client, prompts } = recordingLlm()
    const result = await summarizeMapReduce(
      { title: 'T', subtitlesArray: null, transcriptText: '视频简介兜底文本' },
      deps(client),
    )
    expect(result.chunks).toBe(1)
    expect(prompts[0]).toContain('视频简介兜底文本')
  })
})

describe('summarizeMapReduceStream', () => {
  it('streams the final reduce call for a multi-chunk transcript', async () => {
    const { client, generate, stream } = recordingLlm()
    const iterable = await summarizeMapReduceStream(
      transcript(makeItems(6)),
      deps(client, { contextWindow: 4, reserveTokens: 0 }),
    )
    let out = ''
    for await (const chunk of iterable) out += chunk

    expect(out).toBe('red-1')
    expect(generate).toHaveBeenCalledTimes(4) // 3 map + 1 (non-final) reduce
    expect(stream).toHaveBeenCalledTimes(1) // final reduce is streamed
  })

  it('streams the single map call for a short transcript', async () => {
    const { client, stream, generate } = recordingLlm()
    const iterable = await summarizeMapReduceStream(
      transcript([{ text: '只有一句', index: 0 }]),
      deps(client),
    )
    let out = ''
    for await (const chunk of iterable) out += chunk

    expect(out).toBe('map-0')
    expect(stream).toHaveBeenCalledTimes(1)
    expect(generate).not.toHaveBeenCalled()
  })
})
