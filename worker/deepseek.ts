// Stowie's model: DeepSeek in JSON mode (approved for Stowie on 6 Nov 2026, alongside the trip agent).
// The reply must be one JSON object; the caller validates it with zod, so this only parses.
import { z } from 'zod'

export interface DeepSeekEnv {
  DEEPSEEK_API_KEY?: string
  /** Exact model id from DeepSeek's /models list ("deepseek-flash", DeepSeek V4.1 Flash). */
  DEEPSEEK_MODEL?: string
  DEEPSEEK_BASE_URL?: string
}

/** The server has no key or model set, or the account is out of balance. */
export class DeepSeekSetupError extends Error {}
/** DeepSeek answered with an error, was cut off, or sent something that isn't JSON. */
export class DeepSeekReplyError extends Error {}

export const deepseekReady = (env: DeepSeekEnv) => !!env.DEEPSEEK_API_KEY && !!env.DEEPSEEK_MODEL

/** JSON mode needs the word "json" in the prompt; the schema tells the model the exact shape. */
export const withSchema = (system: string, schema: z.ZodType) =>
  `${system}\nReply with one json object that matches this JSON Schema exactly, with no other text:\n${JSON.stringify(z.toJSONSchema(schema))}`

export async function deepseekJson(env: DeepSeekEnv, opts: { system: string; user: string; maxTokens: number; temperature: number; timeoutMs?: number }, doFetch: typeof fetch = fetch): Promise<unknown> {
  if (!deepseekReady(env)) throw new DeepSeekSetupError('DEEPSEEK_API_KEY and DEEPSEEK_MODEL must be set on the server.')
  const res = await doFetch(`${env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/beta'}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60000),
  })
  if (res.status === 401 || res.status === 402) throw new DeepSeekSetupError(res.status === 402 ? 'The DeepSeek account has no balance left.' : 'The DeepSeek key was refused.')
  if (!res.ok) throw new DeepSeekReplyError(`DeepSeek answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
  const body = await res.json() as { choices?: { message?: { content?: string | null }; finish_reason?: string }[] }
  const choice = body.choices?.[0]
  if (choice?.finish_reason === 'length') throw new DeepSeekReplyError('DeepSeek ran out of tokens before finishing.')
  const content = choice?.message?.content
  if (!content) throw new DeepSeekReplyError('DeepSeek sent an empty reply.')
  try { return JSON.parse(content) as unknown }
  catch { throw new DeepSeekReplyError('DeepSeek sent a reply that is not JSON.') }
}
