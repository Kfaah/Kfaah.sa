// deno-lint-ignore-file no-explicit-any
import { ImapFlow } from 'npm:imapflow@1.0.164'
import { simpleParser } from 'npm:mailparser@3.7.1'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeMessageId(v: any): string | null {
  if (!v) return null
  const s = String(v).trim().replace(/^<|>$/g, '')
  return s || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const user = Deno.env.get('ZOHO_MAIL_USER')
  const pass = Deno.env.get('ZOHO_MAIL_APP_PASSWORD')

  if (!user || !pass) {
    return new Response(JSON.stringify({ error: 'Zoho credentials missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const stats = { fetched: 0, inserted: 0, skipped: 0, errors: 0 }

  console.log('[imap] connecting as', user)
  const client = new ImapFlow({
    host: 'imap.zoho.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: {
      debug: () => {},
      info: (o: any) => console.log('[imap:info]', JSON.stringify(o)),
      warn: (o: any) => console.warn('[imap:warn]', JSON.stringify(o)),
      error: (o: any) => console.error('[imap:error]', JSON.stringify(o)),
    } as any,
    tls: { rejectUnauthorized: false },
    socketTimeout: 20_000,
    greetingTimeout: 10_000,
    connectionTimeout: 10_000,
  })

  try {
    await client.connect()
    console.log('[imap] connected, opening INBOX')
    const lock = await client.getMailboxLock('INBOX')
    console.log('[imap] mailbox locked')
    try {
      // Get last sync time (default to 24h ago first run)
      const { data: settings } = await supabase
        .from('platform_email_sync_settings')
        .select('last_synced_at')
        .eq('id', true)
        .maybeSingle()

      const since = settings?.last_synced_at
        ? new Date(settings.last_synced_at)
        : new Date(Date.now() - 24 * 60 * 60 * 1000)

      const uids = await client.search({ since }, { uid: true })
      stats.fetched = (uids || []).length

      for await (const msg of client.fetch(uids || [], { source: true, envelope: true, internalDate: true }, { uid: true })) {
        try {
          const parsed: any = await simpleParser(msg.source as Uint8Array)
          const providerId = normalizeMessageId(parsed.messageId || msg.envelope?.messageId)
          const inReplyTo = normalizeMessageId(parsed.inReplyTo || msg.envelope?.inReplyTo)
          const references: string[] = Array.isArray(parsed.references)
            ? parsed.references.map(normalizeMessageId).filter(Boolean) as string[]
            : (parsed.references ? [normalizeMessageId(parsed.references) as string].filter(Boolean) : [])

          // Dedupe by provider_message_id
          if (providerId) {
            const { data: existing } = await supabase
              .from('platform_email_messages')
              .select('id').eq('provider_message_id', providerId).maybeSingle()
            if (existing) { stats.skipped++; continue }
          }

          const fromAddr = parsed.from?.value?.[0]?.address || msg.envelope?.from?.[0]?.address || 'unknown@unknown'
          const fromName = parsed.from?.value?.[0]?.name || msg.envelope?.from?.[0]?.name || null
          const subject = (parsed.subject || msg.envelope?.subject || '(بدون موضوع)').slice(0, 500)
          const body = (parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '').slice(0, 9900)
          const receivedAt = (parsed.date || msg.internalDate || new Date()).toISOString()

          // Find thread: by in-reply-to / references first, else by sender+normalized subject
          let threadId: string | null = null
          const refsToCheck = [inReplyTo, ...references].filter(Boolean) as string[]
          if (refsToCheck.length) {
            const { data: linked } = await supabase
              .from('platform_email_messages')
              .select('thread_id')
              .in('provider_message_id', refsToCheck)
              .limit(1)
              .maybeSingle()
            if (linked) threadId = linked.thread_id
          }

          if (!threadId) {
            const cleanSubject = subject.replace(/^(re|fwd|fw|رد|إعادة توجيه)\s*:\s*/gi, '').trim()
            const { data: thread } = await supabase
              .from('platform_email_threads')
              .select('id')
              .eq('recipient_email', fromAddr.toLowerCase())
              .ilike('subject', `%${cleanSubject}%`)
              .order('last_message_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (thread) threadId = thread.id
          }

          if (!threadId) {
            const { data: newThread, error: tErr } = await supabase
              .from('platform_email_threads')
              .insert({
                recipient_email: fromAddr.toLowerCase(),
                recipient_name: fromName,
                subject,
                unread_for_owner: true,
                last_message_at: receivedAt,
              })
              .select('id').single()
            if (tErr) { stats.errors++; continue }
            threadId = newThread.id
          }

          const { error: insErr } = await supabase
            .from('platform_email_messages')
            .insert({
              thread_id: threadId,
              direction: 'inbound',
              sender_email: fromAddr.toLowerCase(),
              recipient_email: user.toLowerCase(),
              subject,
              body,
              provider_message_id: providerId,
              in_reply_to: inReplyTo,
              raw_headers: { references, from_name: fromName },
              received_at: receivedAt,
            })
          if (insErr) { stats.errors++; continue }
          stats.inserted++
        } catch (e) {
          console.error('msg parse failed', e)
          stats.errors++
        }
      }

      await supabase
        .from('platform_email_sync_settings')
        .upsert({ id: true, sync_token: 'imap', last_synced_at: new Date().toISOString() })
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (e: any) {
    console.error('IMAP error', e)
    try { await client.close() } catch {}
    return new Response(JSON.stringify({ error: e?.message || 'imap_failed', stats }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, stats }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})