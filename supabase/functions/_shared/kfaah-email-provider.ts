export type KfaahEmailPayload = Record<string, unknown>

export class KfaahEmailAPIError extends Error {
  status: number
  retryAfterSeconds: number | null
  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'KfaahEmailAPIError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function sendKfaahEmail(
  payload: KfaahEmailPayload,
  options: { apiKey?: string; sendUrl?: string } = {},
): Promise<void> {
  const sendUrl = options.sendUrl || Deno.env.get('KFAAH_EMAIL_SEND_URL')
  if (!sendUrl) throw new Error('KFAAH_EMAIL_SEND_URL not configured')

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const apiKey = options.apiKey || Deno.env.get('KFAAH_EMAIL_API_KEY')
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(sendUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const retryRaw = response.headers.get('retry-after')
    const retryAfterSeconds = retryRaw && Number.isFinite(Number(retryRaw)) ? Number(retryRaw) : null
    const detail = (await response.text()).slice(0, 500)
    throw new KfaahEmailAPIError(detail || `Email send failed (${response.status})`, response.status, retryAfterSeconds)
  }
}

export function parseKfaahEmailWebhookPayload(body: string): Record<string, unknown> {
  const parsed = JSON.parse(body)
  if (parsed && typeof parsed === 'object' && 'data' in parsed) {
    return (parsed as { data: Record<string, unknown> }).data
  }
  return parsed as Record<string, unknown>
}