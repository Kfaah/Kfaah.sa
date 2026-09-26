// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Discussion endpoint: takes a suggestion + conversation history + user message,
 * replies as an innovation expert. Suggests refinements, implementation steps,
 * trade-offs.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) throw new Error("KFAAH_AI_API_KEY not configured");
    const { suggestion, history, user_message } = await req.json();
    if (!suggestion || !user_message) {
      return new Response(JSON.stringify({ error: "suggestion and user_message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = `أنت مستشار ابتكار ومنتج. تناقش فكرة محددة مع مدير المنصة بأسلوب احترافي مختصر. أعطِ إجابات محددة وقابلة للتنفيذ. لا تكرر ما يعرفه المستخدم. اكتب بالعربية.`;

    const context = `الفكرة قيد النقاش:
- العنوان: ${suggestion.title}
- الوصف: ${suggestion.summary}
- التصنيف: ${suggestion.category}
- المنطقة المستهدفة: ${suggestion.area || "—"}
- الأثر المتوقع: ${suggestion.impact || "—"}
- الأساس البياني: ${typeof suggestion.data_basis === "string" ? suggestion.data_basis : JSON.stringify(suggestion.data_basis)}`;

    const messages: any[] = [
      { role: "system", content: `${sys}\n\n${context}` },
      ...((history || []) as any[]).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: user_message },
    ];

    const r = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { "Authorization": `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.5,
        messages,
      }),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز حد الاستخدام" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "نفذ الرصيد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error("AI gateway error");
    const j = await r.json();
    const reply = j.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("innovation-chat error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});