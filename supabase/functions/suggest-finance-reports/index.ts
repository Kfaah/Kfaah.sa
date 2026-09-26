const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { organization_id } = await req.json();
    if (!organization_id) return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const [orgRes, expRes, donRes, insRes] = await Promise.all([
      supa.from("organizations").select("name").eq("id", organization_id).maybeSingle(),
      supa.from("expenses").select("kind, amount, project_name, expense_date").eq("organization_id", organization_id).limit(500),
      supa.from("donations").select("amount, project_name, status").eq("organization_id", organization_id).eq("status", "success").limit(500),
      supa.from("org_external_insights").select("category, title, occurred_at").eq("organization_id", organization_id).limit(50),
    ]);
    const orgName = orgRes.data?.name || "الجمعية";
    const expenses = expRes.data || [];
    const donations = donRes.data || [];
    const insights = insRes.data || [];

    const totalExp = expenses.reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const totalDon = donations.reduce((s, d: any) => s + Number(d.amount || 0), 0);
    const projects = Array.from(new Set([...expenses.map((e: any) => e.project_name), ...donations.map((d: any) => d.project_name)].filter(Boolean)));

    const summary = `جمعية: ${orgName}
إجمالي تبرعات: ${totalDon} ر.س عبر ${donations.length} عملية
إجمالي مصروفات: ${totalExp} ر.س عبر ${expenses.length} عملية
المشاريع: ${projects.slice(0, 15).join(" | ") || "لا توجد"}
محتوى من موقع/سوشيال الجمعية: ${insights.slice(0, 10).map((i: any) => `[${i.category}] ${i.title}`).join(" / ") || "لا يوجد"}`;

    const resp = await fetch((Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions"), {
      method: "POST",
      headers: { Authorization: `Bearer ${KFAAH_AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت خبير تقارير مالية للجمعيات الخيرية. تقترح تقارير عملية تعزز ثقة المتبرعين وتحسّن إدارة الجمعية." },
          { role: "user", content: `بناءً على هذه البيانات اقترح 6-8 تقارير ذكية يجب على الجمعية إصدارها. كل تقرير يجب أن يكون عملياً ومحدداً.\n\n${summary}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_suggestions",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      audience: { type: "string", description: "الجمهور المستهدف" },
                      benefit: { type: "string", description: "الفائدة المتوقعة" },
                      category: { type: "string", enum: ["donor","executive","project","marketing","operational"] },
                      priority: { type: "integer", minimum: 1, maximum: 10 },
                    },
                    required: ["title","description","audience","benefit","category","priority"],
                  },
                },
              },
              required: ["suggestions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_suggestions" } },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "credits_required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "ai_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : { suggestions: [] };

    // Replace previous suggestions
    await supa.from("smart_report_suggestions").delete().eq("organization_id", organization_id).eq("is_archived", false);
    if (parsed.suggestions?.length) {
      const rows = parsed.suggestions.map((s: any) => ({ ...s, organization_id }));
      await supa.from("smart_report_suggestions").insert(rows);
    }

    return new Response(JSON.stringify({ count: parsed.suggestions?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});