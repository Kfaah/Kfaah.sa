import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GATEWAY = 'https://connector-gateway.lovable.dev/google_mail/gmail/v1'

function b64urlEncode(str: string) {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildRaw(opts: { to: string; subject: string; body: string; from?: string; cc?: string; replyTo?: string; inReplyTo?: string; references?: string }) {
  const lines = [
    `To: ${opts.to}`,
    opts.cc ? `Cc: ${opts.cc}` : '',
    opts.from ? `From: ${opts.from}` : '',
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : '',
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : '',
    opts.references ? `References: ${opts.references}` : '',
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.body,
  ].filter(Boolean)
  return b64urlEncode(lines.join('\r\n'))
}

async function gw(path: string, init: RequestInit = {}) {
  const LK = Deno.env.get('LOVABLE_API_KEY')
  const GK = Deno.env.get('GOOGLE_MAIL_API_KEY')
  if (!LK) throw new Error('LOVABLE_API_KEY missing')
  if (!GK) throw new Error('GOOGLE_MAIL_API_KEY missing')
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${LK}`)
  headers.set('X-Connection-Api-Key', GK)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Auth: require super_admin
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData } = await supabase.auth.getUser(jwt)
    const user = userData?.user
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: isAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id })
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    let result: any
    switch (action) {
      case 'list': {
        const q = body.q || 'in:inbox'
        const max = Math.min(Number(body.maxResults) || 25, 100)
        const pageToken = body.pageToken ? `&pageToken=${encodeURIComponent(body.pageToken)}` : ''
        const list = await gw(`/users/me/messages?maxResults=${max}&q=${encodeURIComponent(q)}${pageToken}`)
        const ids: string[] = (list.messages || []).map((m: any) => m.id)
        const metas = await Promise.all(ids.map((id) =>
          gw(`/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`)
        ))
        result = {
          nextPageToken: list.nextPageToken || null,
          messages: metas.map((m: any) => {
            const headers: Record<string, string> = {}
            for (const h of (m.payload?.headers || [])) headers[h.name.toLowerCase()] = h.value
            return {
              id: m.id,
              threadId: m.threadId,
              snippet: m.snippet,
              labelIds: m.labelIds || [],
              unread: (m.labelIds || []).includes('UNREAD'),
              from: headers['from'] || '',
              to: headers['to'] || '',
              subject: headers['subject'] || '(بدون موضوع)',
              date: headers['date'] || '',
              internalDate: m.internalDate,
            }
          }),
        }
        break
      }
      case 'get': {
        const id = body.id
        const m = await gw(`/users/me/messages/${id}?format=full`)
        const headers: Record<string, string> = {}
        for (const h of (m.payload?.headers || [])) headers[h.name.toLowerCase()] = h.value
        // extract text/html or text/plain
        function findPart(p: any, mime: string): any {
          if (!p) return null
          if (p.mimeType === mime && p.body?.data) return p
          if (p.parts) for (const c of p.parts) { const f = findPart(c, mime); if (f) return f }
          return null
        }
        function decode(data: string) {
          const norm = data.replace(/-/g, '+').replace(/_/g, '/')
          const bin = atob(norm)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          return new TextDecoder('utf-8').decode(bytes)
        }
        const html = findPart(m.payload, 'text/html')
        const plain = findPart(m.payload, 'text/plain')
        result = {
          id: m.id,
          threadId: m.threadId,
          labelIds: m.labelIds || [],
          snippet: m.snippet,
          headers,
          html: html ? decode(html.body.data) : null,
          text: plain ? decode(plain.body.data) : null,
        }
        break
      }
      case 'send': {
        const raw = buildRaw({
          to: body.to,
          subject: body.subject || '',
          body: body.body || '',
          cc: body.cc,
          inReplyTo: body.inReplyTo,
          references: body.references,
        })
        const payload: any = { raw }
        if (body.threadId) payload.threadId = body.threadId
        result = await gw('/users/me/messages/send', { method: 'POST', body: JSON.stringify(payload) })
        break
      }
      case 'modify': {
        result = await gw(`/users/me/messages/${body.id}/modify`, {
          method: 'POST',
          body: JSON.stringify({ addLabelIds: body.addLabelIds || [], removeLabelIds: body.removeLabelIds || [] }),
        })
        break
      }
      case 'trash': {
        result = await gw(`/users/me/messages/${body.id}/trash`, { method: 'POST' })
        break
      }
      case 'profile': {
        result = await gw('/users/me/profile')
        break
      }
      default:
        return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    console.error('gmail-api error', e?.message || e)
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})