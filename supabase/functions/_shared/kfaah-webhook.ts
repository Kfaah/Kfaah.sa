export type KfaahWebhookErrorCode =
  | 'invalid_signature'
  | 'missing_timestamp'
  | 'invalid_timestamp'
  | 'stale_timestamp'
  | 'invalid_payload'
  | 'invalid_json'

export class WebhookError extends Error {
  code: KfaahWebhookErrorCode
  constructor(code: KfaahWebhookErrorCode, message: string) {
    super(message)
    this.name = 'WebhookError'
    this.code = code
  }
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyWebhookRequest<T>(args: {
  req: Request
  secret: string
  parser: (body: string) => T
  maxAgeSeconds?: number
}): Promise<{ payload: T }> {
  const timestamp = args.req.headers.get('x-kfaah-timestamp')
  const signature = args.req.headers.get('x-kfaah-signature')
  if (!timestamp) throw new WebhookError('missing_timestamp', 'Missing timestamp')
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) throw new WebhookError('invalid_timestamp', 'Invalid timestamp')
  const age = Math.abs(Date.now() / 1000 - ts)
  if (age > (args.maxAgeSeconds ?? 300)) throw new WebhookError('stale_timestamp', 'Stale timestamp')
  if (!signature) throw new WebhookError('invalid_signature', 'Missing signature')

  const body = await args.req.text()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(args.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)))
  const normalized = signature.replace(/^sha256=/i, '').trim().toLowerCase()
  if (!safeEqual(expected, normalized)) throw new WebhookError('invalid_signature', 'Invalid signature')

  try {
    return { payload: args.parser(body) }
  } catch (error) {
    if (error instanceof SyntaxError) throw new WebhookError('invalid_json', 'Invalid JSON')
    throw new WebhookError('invalid_payload', error instanceof Error ? error.message : 'Invalid payload')
  }
}