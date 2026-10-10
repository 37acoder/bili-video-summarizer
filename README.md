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
captions (or, as a fallback, the video description). When captions cannot be
obtained, or the available text is too thin, the request throws
`SummarizeError` with `code: 'NO_TRANSCRIPT'` instead of prompting the model
with it; an explicitly-labelled deterministic fallback is available via opt-in
(see [Missing transcripts](#missing-transcripts)). The value of this module is the
caption extraction, the prompt template, and the plumbing, all extracted so it
can be embedded in another project (Next.js route, worker, CLI, ...).

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

Two options control what happens when there is no usable transcript:
`onMissingTranscript` (`'throw'` | `'degrade'`, default `'throw'`) and
`minTranscriptTokens` (default `40`). Both can also be set as defaults on
`createVideoSummarizer`, and per-request values override them. See
[Missing transcripts](#missing-transcripts).

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

### Missing transcripts

A transcript is **missing** when the captions are absent (so the module fell back
to the description, `usedDescription === true`) or when the available text is
**too thin** — fewer than `minTranscriptTokens` estimated tokens (default `40`,
using the same `estimateTokens` approximation as the chunker). A one-line
description is far below that; a real caption track comfortably exceeds it.

The chaptered-outline prompt is never fed a missing/too-thin transcript, because
doing so makes the model invent confident chapters and `[00:00]` timestamps from
the title alone. By default the request **fails**:

- `onMissingTranscript: 'throw'` (default) rejects with a `SummarizeError` whose
  `code` is `'NO_TRANSCRIPT'` and `statusCode` is `501`.
- `onMissingTranscript: 'degrade'` is an explicit opt-in that returns a
  deterministic, no-LLM fallback that is clearly labelled, e.g.

  ```
  ⚠️ 未获取到字幕，以下仅依据标题与简介整理，可能不完整。

  标题：<title>

  简介：<description>
  ```

  The notice is localised (`zh`/`en`); the body is the description (or the thin
  captions) verbatim, so no content can be fabricated. There are no
  `### [mm:ss]` chapter headings.

Set `minTranscriptTokens: 0` to disable the size check (only description-only
transcripts then count as missing). A video with neither captions nor a
description always throws `'NO_TRANSCRIPT'`, whatever the policy.

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
- **No fabricated chapters for missing transcripts.** When the transcript is
  description-only or too thin (below `minTranscriptTokens`), the chaptered
  outline is skipped and the request throws `SummarizeError: 'NO_TRANSCRIPT'` by
  default. Callers can opt into `onMissingTranscript: 'degrade'` for a
  deterministic, explicitly-labelled grounded fallback. Upstream (and this
  module before this change) prompted the model with the thin text and the
  title, which produced invented chapters and `[00:00]` timestamps.
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

- Summaries are only as good as the captions. A description-only or too-thin
  transcript is **not** summarized as a chaptered outline (that produced
  fabricated chapters/timestamps): by default the request throws
  `SummarizeError` with `code: 'NO_TRANSCRIPT'`. Opt into
  `onMissingTranscript: 'degrade'` for an explicitly-labelled, deterministic
  grounded summary instead. Videos with neither captions nor a description always
  throw `'NO_TRANSCRIPT'`. See [Missing transcripts](#missing-transcripts).
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
