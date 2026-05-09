// deno-lint-ignore-file no-explicit-any
// Public webhook to receive forwarded emails (from Zoho forwarding, Cloudflare Email Routing,
// SendGrid Inbound Parse, Mailgun routes, or a simple forwarding-to-HTTP service).
// Accepts JSON or multipart/form-data. Stores the email into platform_email_threads/messages.
import { simpleParser } from 'npm:mailparser@3.7.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizeMessageId(v: any): string | null {
  if (!v) return null
  const s = String(v).trim().replace(/^<|>$/g, '')
  return s || null
}

function extractEmail(s: string | null | undefined): string | null {
  if (!s) return null
  const m = String(s).match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  return m ? m[0].toLowerCase() : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const ct = req.headers.get('content-type') || ''
    let from = '', fromName: string | null = null
    let to = '', subject = '', body = '', html = ''
    let providerId: string | null = null
    let inReplyTo: string | null = null
    let references: string[] = []
    let receivedAt = new Date().toISOString()
    let raw = ''

    if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
      // SendGrid Inbound Parse / Mailgun-style
      const form = await req.formData()
      from = String(form.get('from') || form.get('From') || '')
      to = String(form.get('to') || form.get('To') || '')
      subject = String(form.get('subject') || form.get('Subject') || '(بدون موضوع)')
      body = String(form.get('text') || form.get('body-plain') || '')
      html = String(form.get('html') || form.get('body-html') || '')
      raw = String(form.get('email') || form.get('raw') || '')
    } else {
      const json = await req.json().catch(() => ({} as any))
      from = String(json.from || json.From || json.sender || '')
      to = String(json.to || json.To || json.recipient || '')
      subject = String(json.subject || json.Subject || '(بدون موضوع)')
      body = String(json.text || json.body || json.plain || '')
      html = String(json.html || '')
      raw = String(json.raw || json.rfc822 || '')
      providerId = normalizeMessageId(json.messageId || json['message-id'] || json.Message_Id)
      inReplyTo = normalizeMessageId(json.inReplyTo || json['in-reply-to'])
      if (json.date) { try { receivedAt = new Date(json.date).toISOString() } catch {} }
    }

    // If a raw RFC822 message was supplied, parse it for richer fields
    if (raw) {
      try {
        const parsed: any = await simpleParser(raw)
        from = parsed.from?.value?.[0]?.address ? `${parsed.from?.value?.[0]?.name || ''} <${parsed.from.value[0].address}>` : from
        fromName = parsed.from?.value?.[0]?.name || fromName
        subject = parsed.subject || subject
        body = parsed.text || body
        html = parsed.html || html
        providerId = providerId || normalizeMessageId(parsed.messageId)
        inReplyTo = inReplyTo || normalizeMessageId(parsed.inReplyTo)
        references = Array.isArray(parsed.references)
          ? parsed.references.map(normalizeMessageId).filter(Boolean) as string[]
          : (parsed.references ? [normalizeMessageId(parsed.references)].filter(Boolean) as string[] : [])
        if (parsed.date) receivedAt = new Date(parsed.date).toISOString()
      } catch (e) { console.error('raw parse failed', e) }
    }

    const senderEmail = extractEmail(from)
    if (!senderEmail) {
      return new Response(JSON.stringify({ error: 'missing_sender' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const finalBody = (body || (html ? html.replace(/<[^>]+>/g, ' ') : '')).slice(0, 9900)
    const finalSubject = (subject || '(بدون موضوع)').slice(0, 500)

    // Dedupe by provider_message_id
    if (providerId) {
      const { data: existing } = await supabase
        .from('platform_email_messages')
        .select('id').eq('provider_message_id', providerId).maybeSingle()
      if (existing) {
        return new Response(JSON.stringify({ success: true, deduped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Find or create thread
    let threadId: string | null = null
    const refsToCheck = [inReplyTo, ...references].filter(Boolean) as string[]
    if (refsToCheck.length) {
      const { data: linked } = await supabase
        .from('platform_email_messages')
        .select('thread_id')
        .in('provider_message_id', refsToCheck)
        .limit(1).maybeSingle()
      if (linked) threadId = linked.thread_id
    }
    if (!threadId) {
      const cleanSubject = finalSubject.replace(/^(re|fwd|fw|رد|إعادة توجيه)\s*:\s*/gi, '').trim()
      const { data: thread } = await supabase
        .from('platform_email_threads')
        .select('id')
        .eq('recipient_email', senderEmail)
        .ilike('subject', `%${cleanSubject}%`)
        .order('last_message_at', { ascending: false })
        .limit(1).maybeSingle()
      if (thread) threadId = thread.id
    }
    if (!threadId) {
      const { data: newThread, error: tErr } = await supabase
        .from('platform_email_threads')
        .insert({
          recipient_email: senderEmail,
          recipient_name: fromName,
          subject: finalSubject,
          unread_for_owner: true,
          last_message_at: receivedAt,
        })
        .select('id').single()
      if (tErr) throw tErr
      threadId = newThread.id
    }

    const { error: insErr } = await supabase
      .from('platform_email_messages')
      .insert({
        thread_id: threadId,
        direction: 'inbound',
        sender_email: senderEmail,
        recipient_email: extractEmail(to) || 'info@kfaah.org',
        subject: finalSubject,
        body: finalBody,
        provider_message_id: providerId,
        in_reply_to: inReplyTo,
        raw_headers: { references, from, to, source: 'webhook' },
        received_at: receivedAt,
      })
    if (insErr) throw insErr

    return new Response(JSON.stringify({ success: true, thread_id: threadId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('inbound webhook error', e)
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})