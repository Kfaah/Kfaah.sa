// deno-lint-ignore-file no-explicit-any
import { ImapFlow } from 'npm:imapflow@1.0.164'
import { simpleParser } from 'npm:mailparser@3.7.1'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Buffer } from 'node:buffer'

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
      // Get last sync time. If it was never saved, start from the newest message we already have.
      const { data: settings } = await supabase
        .from('platform_email_sync_settings')
        .select('last_synced_at')
        .eq('id', true)
        .maybeSingle()
      const { data: latestStored } = await supabase
        .from('platform_email_messages')
        .select('received_at')
        .eq('direction', 'inbound')
        .order('received_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const latestStoredAt = latestStored?.received_at ? new Date(latestStored.received_at) : null
      const baseSince = settings?.last_synced_at
        ? new Date(settings.last_synced_at)
        : latestStoredAt || new Date(Date.now() - 24 * 60 * 60 * 1000)
      // Always overlap the previous sync window. Some mailboxes expose a new email
      // a few minutes after its internal date, so using last_synced_at exactly can
      // permanently skip fresh messages. Dedupe by Message-ID keeps this safe.
      const since = new Date(baseSince.getTime() - 15 * 60 * 1000)

      console.log('[imap] searching since', since.toISOString())
      const uids = await client.search({ since }, { uid: true })
      console.log('[imap] search returned', (uids || []).length, 'uids')
      stats.fetched = (uids || []).length

      // Process newest first and cap per-invocation work to avoid 504 timeouts
      const allUids: number[] = ((uids as any[]) || []).slice().sort((a, b) => b - a)
      const MAX_PER_RUN = 8
      const startedAt = Date.now()
      const MAX_RUNTIME_MS = 8_000
      const uidList = allUids.slice(0, MAX_PER_RUN)
      console.log('[imap] processing', uidList.length, 'messages')
      for (const uid of uidList) {
        if (Date.now() - startedAt > MAX_RUNTIME_MS) {
          console.log('[imap] stopping early to avoid timeout')
          break
        }
        try {
          console.log('[imap] fetching uid', uid)
          const msg: any = await (client as any).fetchOne(uid, { envelope: true, internalDate: true }, { uid: true })
          if (!msg) { console.log('[imap] no envelope for', uid); stats.skipped++; continue }
          const msgDate = msg.internalDate ? new Date(msg.internalDate) : null
          const oldMessageCutoff = latestStoredAt ? new Date(latestStoredAt.getTime() - 15 * 60 * 1000) : null
          if (oldMessageCutoff && msgDate && msgDate < oldMessageCutoff) {
            stats.skipped++
            continue
          }
          const envelopeProviderId = normalizeMessageId(msg.envelope?.messageId)
          if (envelopeProviderId) {
            const { data: tomb } = await supabase
              .from('platform_email_deleted_ids')
              .select('id')
              .eq('provider_message_id', envelopeProviderId)
              .maybeSingle()
            if (tomb) { stats.skipped++; continue }
            const { data: existing } = await supabase
              .from('platform_email_messages')
              .select('id')
              .eq('provider_message_id', envelopeProviderId)
              .maybeSingle()
            if (existing) { stats.skipped++; continue }
          }
          console.log('[imap] downloading source for uid', uid)
          const dl: any = await (client as any).download(uid, undefined, { uid: true })
          const chunks: Uint8Array[] = []
          if (dl?.content) {
            const reader = dl.content.getReader ? dl.content.getReader() : null
            if (reader) {
              while (true) {
                const { value, done } = await reader.read()
                if (done) break
                if (value) chunks.push(value)
              }
            } else {
              for await (const c of dl.content as any) chunks.push(c)
            }
          }
          const total = chunks.reduce((a, c) => a + c.length, 0)
          const source = new Uint8Array(total)
          let off = 0
          for (const c of chunks) { source.set(c, off); off += c.length }
          console.log('[imap] downloaded', source.length, 'bytes for uid', uid)
          const parsed: any = await simpleParser(Buffer.from(source))
          ;(msg as any).source = source
          const providerId = normalizeMessageId(parsed.messageId || msg.envelope?.messageId)
          const inReplyTo = normalizeMessageId(parsed.inReplyTo || msg.envelope?.inReplyTo)
          const references: string[] = Array.isArray(parsed.references)
            ? parsed.references.map(normalizeMessageId).filter(Boolean) as string[]
            : (parsed.references ? [normalizeMessageId(parsed.references) as string].filter(Boolean) : [])

          // Dedupe by provider_message_id
          if (providerId) {
            const { data: tomb2 } = await supabase
              .from('platform_email_deleted_ids')
              .select('id')
              .eq('provider_message_id', providerId)
              .maybeSingle()
            if (tomb2) { stats.skipped++; continue }
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

      const { error: syncErr } = await supabase
        .from('platform_email_sync_settings')
        .upsert({ id: true, sync_token: 'imap', last_synced_at: new Date().toISOString() }, { onConflict: 'id' })
      if (syncErr) console.error('[imap] sync settings update failed', syncErr)
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