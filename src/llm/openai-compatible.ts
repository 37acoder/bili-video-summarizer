/**
 * Default LLM client backed by the Vercel AI SDK's OpenAI-compatible provider.
 *
 * Ported from BibiGPT-v1 `lib/openai/fetchOpenAIResult.ts` (streaming +
 * non-streaming paths) and `lib/openai/trimOpenAiResult.ts`.
 *
 * Streaming is exposed as an `AsyncIterable<string>` (the SDK's `textStream`)
 * instead of an encoded `ReadableStream`, which is friendlier to reuse; the
 * caller can encode it for an HTTP response if needed.
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText, streamText, type ModelMessage } from 'ai'
import { DEFAULT_OPENAI_COMPATIBLE_BASE_URL, type LlmConfig } from '../config'
import type { ChatMessage, GenerateParams, LlmClient, Logger } from '../types'
import { readEnv } from '../utils/env'
import { noopLogger } from '../utils/logger'

/** Strip a leading double newline, matching BibiGPT's `trimOpenAiResult`. */
export function trimResult(result: string): string {
  return result.startsWith('\n\n') ? result.slice(2) : result
}

export function normalizeBaseUrl(baseUrl?: string): string {
  const value = baseUrl?.trim()
  if (!value) {
    return ''
  }
  if (!/^https?:\/\//.test(value)) {
    throw new Error('baseUrl must start with http:// or https://')
  }
  return value.replace(/\/+$/, '')
}

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content })) as ModelMessage[]
}

/** Resolve the API key from explicit config or the environment. */
export function resolveApiKey(config: LlmConfig = {}): string {
  return config.apiKey ?? readEnv('OPENAI_COMPATIBLE_API_KEY') ?? readEnv('OPENAI_API_KEY') ?? ''
}

/**
 * Create an `LlmClient` that talks to any OpenAI-compatible endpoint.
 * Config falls back to `OPENAI_COMPATIBLE_*` environment variables.
 */
export function createOpenAICompatibleClient(config: LlmConfig = {}, logger: Logger = noopLogger): LlmClient {
  const providerName = config.providerName ?? readEnv('OPENAI_COMPATIBLE_PROVIDER_NAME') ?? 'openai-compatible'
  const baseURL =
    normalizeBaseUrl(config.baseUrl ?? readEnv('OPENAI_COMPATIBLE_BASE_URL')) || DEFAULT_OPENAI_COMPATIBLE_BASE_URL
  const apiKey = resolveApiKey(config)

  if (!apiKey) {
    logger.warn('No OpenAI-compatible API key configured; LLM calls will fail until one is provided.')
  }

  const provider = createOpenAICompatible({ name: providerName, baseURL, apiKey })

  /** Forward the reasoning effort through the provider options seam. */
  function providerOptions(params: GenerateParams) {
    return params.reasoningEffort
      ? { openaiCompatible: { reasoningEffort: params.reasoningEffort } }
      : undefined
  }

  return {
    async generate(params: GenerateParams): Promise<string> {
      const result = await generateText({
        model: provider.chatModel(params.model),
        messages: toModelMessages(params.messages),
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        topP: params.topP,
        frequencyPenalty: params.frequencyPenalty,
        presencePenalty: params.presencePenalty,
        providerOptions: providerOptions(params),
        abortSignal: params.signal,
      })
      return trimResult(result.text)
    },

    async stream(params: GenerateParams): Promise<AsyncIterable<string>> {
      const result = streamText({
        model: provider.chatModel(params.model),
        messages: toModelMessages(params.messages),
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        topP: params.topP,
        frequencyPenalty: params.frequencyPenalty,
        presencePenalty: params.presencePenalty,
        providerOptions: providerOptions(params),
        abortSignal: params.signal,
      })
      return result.textStream
    },
  }
}
