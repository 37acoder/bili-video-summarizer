# video-summarizer

A small, framework-agnostic TypeScript module that summarizes YouTube / Bilibili
videos the same way [BibiGPT-v1](https://github.com/JimmyLv/BibiGPT) does:

```
video request
  → fetch captions        (YouTube via savesubs.com, Bilibili via official APIs)
  → map-reduce            (split the transcript at 50% of the model context
                          window; summarize each segment; merge segment
                          summaries while carrying the accumulated summary and
                          the raw subtitles around each segment seam)
  → build prompt
  → call an OpenAI-compatible LLM
  → cache the result
```

It contains **no video/audio understanding** — the model only ever sees the
captions (or, as a fallback, the video description). The value of this module is
the caption extraction, the prompt template, and the plumbing, all extracted so
it can be embedded in another project (Next.js route, worker, CLI, ...).

> Extracted from BibiGPT-v1 (GPL-3.0). Upstream attribution is preserved in the
> ported files — see `NOTICE`. This module is therefore also GPL-3.0-only.

## Install

```bash
npm install
npm run build      # emits dist/ (ESM + CJS + .d.ts)
npm test           # unit + integration tests (fake fetch / fake LLM)
```

Runtime dependencies: `ai` and `@ai-sdk/openai-compatible` (the Vercel AI SDK).

## Quick start

```ts
import { createVideoSummarizer } from 'video-summarizer'

const summarizer = createVideoSummarizer({
  llm: {
    apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
    baseUrl: process.env.OPENAI_COMPATIBLE_BASE_URL, // any OpenAI-compatible endpoint
    model: 'deepseek-flash',
  },
  subtitle: {
    savesubsAuthToken: process.env.SAVESUBS_X_AUTH_TOKEN,
    bilibiliSessionTokens: process.env.BILIBILI_SESSION_TOKEN,
  },
})

// Complete text
const summary = await summarizer.summarize({
  video: { source: 'youtube', videoId: 'dQw4w9WgXcQ' },
  options: { outputLanguage: 'zh-CN', sentenceNumber: 5, detailLevel: 600, showTimestamp: true },
})

// Token stream (e.g. for an HTTP response)
const stream = await summarizer.summarizeStream({ video: { source: 'bilibili', videoId: 'BV1xx411c7mD' } })
for await (const chunk of stream) process.stdout.write(chunk)

// Just the transcript, no LLM call
const transcript = await summarizer.fetchTranscript({ video: { source: 'youtube', videoId: 'dQw4w9WgXcQ' } })
```

## API

`createVideoSummarizer(options)` returns:

| Method | Description |
| --- | --- |
| `summarize(input)` | Fetch captions, prompt the LLM, return the full summary text. |
| `summarizeStream(input)` | Same, but returns `AsyncIterable<string>`. |
| `buildPrompt(input)` | Resolve the caption + prompt + model into a `BuiltPrompt` (no LLM call). For long transcripts it returns the first *map* prompt and lists the rest under `stages`. |
| `fetchTranscript(input)` | Return the extracted transcript (the full text; chunking happens at summarize time). |
| `cacheKey(input)` | Deterministic cache key for a request. |

`input` is `{ video: { source: 'youtube' | 'bilibili', videoId, pageNumber? }, options? }`.

`options` maps to BibiGPT's UI controls: `model`, `outputLanguage`,
`detailLevel`, `sentenceNumber`, `outlineLevel`, `showTimestamp`, `showEmoji`,
plus `summaryFormat`, `maxOutputTokens`, `reasoningEffort`, sampling params and
an `AbortSignal`.

### Summary format

The default output is a **chaptered outline** whose length adapts to the video:

```
## 一句话总结 / ## Summary
<one sentence>
## 章节要点 / ## Chapters
### [mm:ss] <chapter title>
- <1-3 key points>
...
## 关键结论 / ## Key Takeaways
- <conclusions / actions>
```

- The chapter count is derived from the duration (~1 chapter per two minutes)
  or the transcript size, clamped to 1–12; an explicit `sentenceNumber`
  overrides it. `maxOutputTokens` scales with the chapter count so the outline
  is not truncated.
- Set `summaryFormat: 'bullets'` to restore the original BibiGPT
  `## Summary / ## Highlights` bullet template.
- For long transcripts the same outline is produced via map-reduce: segments are
  summarized, then a rolling reduce merges them (chapter count computed from the
  full transcript, seam subtitles preserved).

### Injection points

Everything external is pluggable:

```ts
createVideoSummarizer({
  llm: { apiKey, baseUrl, model },  // default OpenAI-compatible client
  llmClient,                        // or bring your own LlmClient
  subtitle: { ... },
  cache: myRedisCache,              // CacheStore, or false to disable
  fetch: myFetch,                   // override fetch
  logger,
  hasUserKey: true,                 // affects the default max_tokens (800 vs 600)
})
```

## Environment variables

Falls back to these when not passed in code — see `.env.example`.

| Variable | Purpose |
| --- | --- |
| `OPENAI_COMPATIBLE_API_KEY` / `OPENAI_API_KEY` | LLM key |
| `OPENAI_COMPATIBLE_BASE_URL` | LLM base URL |
| `OPENAI_COMPATIBLE_MODEL` | default model |
| `OPENAI_COMPATIBLE_REASONING_EFFORT` | reasoning/thinking effort (`none` disables the hidden thinking phase; recommended for DeepSeek-style reasoning models used for summarization) |
| `SAVESUBS_X_AUTH_TOKEN` | savesubs.com auth token (YouTube) |
| `SAVESUBS_BASE_URL` | savesubs.com base URL |
| `BILIBILI_SESSION_TOKEN` | Bilibili SESSDATA cookie (comma-separated to rotate) |

## Mapping to BibiGPT-v1

| This module | BibiGPT-v1 source |
| --- | --- |
| `src/summarizer.ts` | `lib/openai/buildSummarizeRequest.ts` + `pages/api/chat.ts` |
| `src/subtitles/index.ts` | `lib/fetchSubtitle.ts` |
| `src/subtitles/youtube.ts` | `lib/youtube/fetchYoutubeSubtitle*.ts` |
| `src/subtitles/bilibili.ts` | `lib/bilibili/fetchBilibiliSubtitle*.ts` |
| `src/subtitles/reduce-subtitle-timestamp.ts` | `utils/reduceSubtitleTimestamp.ts` |
| `src/transcript/small-size-transcripts.ts` | `lib/openai/getSmallSizeTranscripts.ts` |
| `src/transcript/chunk-transcript.ts` | new — token-budget chunking (no upstream equivalent) |
| `src/summarize/map-reduce.ts` | new — map-reduce orchestration (no upstream equivalent) |
| `src/llm/model-context.ts` | new — model context windows |
| `src/utils/tokens.ts` | new — conservative token estimation |
| `src/prompt/prompt.ts` | `lib/openai/prompt.ts` |
| `src/prompt/language.ts` | `utils/constants/language.ts` |
| `src/llm/openai-compatible.ts` | `lib/openai/fetchOpenAIResult.ts` + `trimOpenAiResult.ts` |
| `src/cache.ts` | `utils/getCacheId.ts` |

### Intentional changes vs. upstream

- **No Next.js / Upstash / Supabase / LemonSqueezy coupling.** Rate limiting,
  licensing, API-key pooling and Redis were left in the app layer; caching and
  `fetch` are now injectable.
- **Streaming returns `AsyncIterable<string>`** (the AI SDK's `textStream`)
  instead of an encoded `ReadableStream`; encode it yourself for HTTP responses.
- **Env access is lazy and browser-safe**, and config is passed explicitly.
- The upstream `showTimestamp` (video config) / `shouldShowTimestamp` (user
  config) duplication is unified into a single `options.showTimestamp`.
- **Bilibili subtitle validation + retry.** `x/player/v2` intermittently
  returns a degraded caption list whose `ai-zh` URL points to an unrelated
  video's caption file. The module now checks the downloaded file's last
  timestamp against the video duration and retries up to 8 times. When nothing
  matches, it degrades to the video description — it never summarizes a
  mismatched (wrong-video) caption file (upstream trusted the first response).
- `SummarizeInput.transcript` lets callers pass a pre-fetched transcript so
  captions are only extracted once per request.
- **Map-reduce instead of random truncation.** Upstream dropped transcript lines
  at random once a ~6.2 KB byte budget was exceeded, so long videos silently lost
  content (and produced different summaries on every run). Long transcripts are
  now split into segments capped at **50% of the model's context window**
  (`resolveContextWindow`), summarized segment-by-segment, and merged with a
  rolling reduce that carries the accumulated summary plus the raw subtitles
  around each segment seam. The default model is `deepseek-flash` (1,048,576-token
  context); override it per request with `options.model`.
- **Chaptered outline by default.** Output is a chaptered outline (one-sentence
  summary → timestamped chapters → key takeaways) whose length adapts to the
  video (see "Summary format"), instead of a fixed number of flat bullets.
  `summaryFormat: 'bullets'` restores the upstream template.
- **Reasoning-aware LLM calls.** Some models (DeepSeek V4.1 Flash) emit a hidden
  reasoning phase that otherwise consumes the whole output budget and returns an
  empty answer. `reasoningEffort` is forwarded as `reasoning_effort`, and
  `deepseek-flash` defaults to `none` for summarization; override with
  `options.reasoningEffort` or `OPENAI_COMPATIBLE_REASONING_EFFORT`.
- `formatSummary` (a UI-only bullet/timestamp renderer) is intentionally not
  ported.

## Notes & limitations

- Summaries are only as good as the captions. Silent videos fall back to the
  description; videos with neither throw `SummarizeError` with `code: 'NO_TRANSCRIPT'`.
- **Token counting is an estimate.** There is no tokenizer dependency; CJK
  characters are counted at 1 token each and other text at ~4 characters per
  token (`estimateTokens`). The estimate errs high for CJK, so a segment never
  overflows the context window — at the cost of occasionally splitting when a
  precise count would have fit. Very long inputs therefore cost multiple LLM
  calls (one map call per segment plus one reduce call per merge).
- A single failed map segment is logged and skipped rather than failing the whole
  summary; a failed reduce step keeps the accumulated summary from the previous
  step. If every segment fails, the request throws.
- YouTube caption extraction depends on the third-party savesubs.com service.

## License

**GPL-3.0-only.** This is a derivative work of
[BibiGPT-v1](https://github.com/JimmyLv/BibiGPT), which is licensed under the
GNU General Public License v3.0. See `LICENSE` and `NOTICE`.

> ⚠️ Because of the copyleft terms, integrating this module into a closed-source
> / proprietary project is generally **not** permitted. Confirm your licensing
> situation before shipping it into another product.
