# video-summarizer

A small, framework-agnostic TypeScript module that summarizes YouTube / Bilibili
videos the same way [BibiGPT-v1](https://github.com/JimmyLv/BibiGPT) does:

```
video request
  → fetch captions        (YouTube via savesubs.com, Bilibili via official APIs)
  → size-limit transcript (~6.2 KB byte budget)
  → build prompt          (title + transcript + instructions)
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
    model: 'gpt-3.5-turbo',
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
| `buildPrompt(input)` | Resolve the caption + prompt + model into a `BuiltPrompt` (no LLM call). |
| `fetchTranscript(input)` | Return the extracted, size-limited transcript. |
| `cacheKey(input)` | Deterministic cache key for a request. |

`input` is `{ video: { source: 'youtube' | 'bilibili', videoId, pageNumber? }, options? }`.

`options` maps to BibiGPT's UI controls: `model`, `outputLanguage`,
`detailLevel`, `sentenceNumber`, `outlineLevel`, `showTimestamp`, `showEmoji`,
plus `maxOutputTokens`, sampling params and an `AbortSignal`.

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
- `formatSummary` (a UI-only bullet/timestamp renderer) is intentionally not
  ported.

## Notes & limitations

- Summaries are only as good as the captions. Silent videos fall back to the
  description; videos with neither throw `SummarizeError` with `code: 'NO_TRANSCRIPT'`.
- The transcript size limiter **drops lines at random** when over budget
  (upstream behavior), so very long videos can lose content.
- YouTube caption extraction depends on the third-party savesubs.com service.

## License

**GPL-3.0-only.** This is a derivative work of
[BibiGPT-v1](https://github.com/JimmyLv/BibiGPT), which is licensed under the
GNU General Public License v3.0. See `LICENSE` and `NOTICE`.

> ⚠️ Because of the copyleft terms, integrating this module into a closed-source
> / proprietary project is generally **not** permitted. Confirm your licensing
> situation before shipping it into another product.
