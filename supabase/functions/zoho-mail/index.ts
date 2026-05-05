import { ImapFlow } from "npm:imapflow@1.0.164";
import nodemailer from "npm:nodemailer@6.9.14";
import { simpleParser } from "npm:mailparser@3.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USER = Deno.env.get("ZOHO_MAIL_USER") || "";
const PASS = Deno.env.get("ZOHO_MAIL_APP_PASSWORD") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function withImap<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: "imap.zoho.com",
    port: 993,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

async function listMessages(mailbox: string, limit: number) {
  return await withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox || "INBOX");
    try {
      const status = await client.status(mailbox || "INBOX", { messages: true });
      const total = status.messages || 0;
      if (total === 0) return { total: 0, messages: [] };
      const from = Math.max(1, total - limit + 1);
      const range = `${from}:${total}`;
      const messages: any[] = [];
      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        bodyStructure: true,
      })) {
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          subject: msg.envelope?.subject || "(بدون موضوع)",
          from: msg.envelope?.from?.[0]
            ? {
                name: msg.envelope.from[0].name || "",
                address: msg.envelope.from[0].address || "",
              }
            : null,
          to: (msg.envelope?.to || []).map((a: any) => ({
            name: a.name || "",
            address: a.address || "",
          })),
          date: msg.envelope?.date || msg.internalDate,
          seen: msg.flags?.has("\\Seen") || false,
          flagged: msg.flags?.has("\\Flagged") || false,
        });
      }
      messages.sort((a, b) => +new Date(b.date) - +new Date(a.date));
      return { total, messages };
    } finally {
      lock.release();
    }
  });
}

async function getMessage(mailbox: string, uid: number) {
  return await withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox || "INBOX");
    try {
      const dl = await client.download(String(uid), undefined, { uid: true });
      if (!dl) throw new Error("message_not_found");
      const parsed = await simpleParser(dl.content as any);
      // mark as read
      try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch {}
      return {
        uid,
        subject: parsed.subject || "(بدون موضوع)",
        from: parsed.from?.value?.[0] || null,
        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap((t: any) => t.value || []) : [],
        date: parsed.date,
        text: parsed.text || "",
        html: parsed.html || "",
        attachments: (parsed.attachments || []).map((a: any) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
        })),
      };
    } finally {
      lock.release();
    }
  });
}

async function sendMessage(payload: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  bcc?: string;
}) {
  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: { user: USER, pass: PASS },
  });
  const info = await transporter.sendMail({
    from: USER,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

async function deleteMessage(mailbox: string, uid: number) {
  return await withImap(async (client) => {
    const lock = await client.getMailboxLock(mailbox || "INBOX");
    try {
      await client.messageDelete(String(uid), { uid: true });
      return { ok: true };
    } finally {
      lock.release();
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!USER || !PASS) {
    return json({ error: "ZOHO_MAIL credentials missing" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      case "list": {
        const data = await listMessages(body.mailbox || "INBOX", Math.min(Number(body.limit) || 30, 100));
        return json(data);
      }
      case "get": {
        const data = await getMessage(body.mailbox || "INBOX", Number(body.uid));
        return json(data);
      }
      case "send": {
        if (!body.to || !body.subject) return json({ error: "to and subject are required" }, 400);
        const data = await sendMessage(body);
        return json(data);
      }
      case "delete": {
        const data = await deleteMessage(body.mailbox || "INBOX", Number(body.uid));
        return json(data);
      }
      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e: any) {
    console.error("zoho-mail error:", e?.message, e?.stack, JSON.stringify(e));
    return json({ error: e?.message || "internal_error", stack: e?.stack }, 500);
  }
});