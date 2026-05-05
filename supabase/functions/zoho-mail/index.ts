import nodemailer from "npm:nodemailer@6.9.14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USER = Deno.env.get("ZOHO_MAIL_USER") || "";
const PASS = Deno.env.get("ZOHO_MAIL_APP_PASSWORD") || "";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!USER || !PASS) return json({ error: "ZOHO_MAIL credentials missing" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action !== "send") return json({ error: "only_send_supported" }, 400);
    if (!body.to || !body.subject) return json({ error: "to and subject are required" }, 400);

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: { user: USER, pass: PASS },
    });
    const info = await transporter.sendMail({
      from: USER,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
    return json({ messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  } catch (e: any) {
    console.error("zoho-mail error:", e?.message, e?.stack);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
