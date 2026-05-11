const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { suggestion_id, organization_id } = await req.json();
    if (!organization_id || !suggestion_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const [sugRes, orgRes, expRes, donRes, allocRes, donorsRes, insRes] = await Promise.all([
      supa.from("smart_report_suggestions").select("*").eq("id", suggestion_id).maybeSingle(),
      supa.from("organizations").select("name").eq("id", organization_id).maybeSingle(),
      supa.from("expenses").select("kind, amount, project_name, expense_date, description, vendor").eq("organization_id", organization_id).limit(800),
      supa.from("donations").select("amount, project_name, status, donation_date, donor_id").eq("organization_id", organization_id).eq("status", "success").limit(800),
      supa.from("expense_allocations").select("amount_allocated, allocation_type, donor_id").eq("organization_id", organization_id).limit(2000),
      supa.from("donor_spend_summary").select("donor_id, total_donated, total_allocated, fully_spent, primary_project").eq("organization_id", organization_id).limit(500),
      supa.from("org_external_insights").select("category, title, summary, occurred_at").eq("organization_id", organization_id).limit(40),
    ]);

    const suggestion = sugRes.data;
    if (!suggestion) return new Response(JSON.stringify({ error: "suggestion_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const orgName = orgRes.data?.name || "الجمعية";
    const expenses = expRes.data || [];
    const donations = donRes.data || [];
    const allocs = allocRes.data || [];
    const donors = donorsRes.data || [];
    const insights = insRes.data || [];

    const totalExp = expenses.reduce((s, e: any) => s + Number(e.amount || 0), 0);
    const totalDon = donations.reduce((s, d: any) => s + Number(d.amount || 0), 0);
    const totalAlloc = allocs.reduce((s, a: any) => s + Number(a.amount_allocated || 0), 0);
    const byKind = expenses.reduce((acc: Record<string, number>, e: any) => {
      acc[e.kind] = (acc[e.kind] || 0) + Number(e.amount || 0); return acc;
    }, {});
    const byProject: Record<string, number> = {};
    donations.forEach((d: any) => { if (d.project_name) byProject[d.project_name] = (byProject[d.project_name] || 0) + Number(d.amount || 0); });
    const fullySpentCount = donors.filter((d: any) => d.fully_spent).length;

    const summary = `جمعية: ${orgName}
إجمالي تبرعات ناجحة: ${totalDon} ر.س (${donations.length} عملية)
إجمالي مصروفات: ${totalExp} ر.س (${expenses.length} عملية)
إجمالي المُوزَّع على متبرعين: ${totalAlloc} ر.س
توزيع المصروفات: مشاريع=${byKind.project||0}، تسويق=${byKind.marketing||0}، تشغيلي=${byKind.operational||0}
المشاريع الممولة: ${Object.entries(byProject).slice(0,10).map(([n,v])=>`${n} (${v})`).join(" • ") || "لا يوجد"}
متبرعون أُكمل صرف تبرعهم: ${fullySpentCount} من ${donors.length}
محتوى من موقع/سوشيال الجمعية: ${insights.slice(0,12).map((i:any)=>`[${i.category}] ${i.title}${i.summary?` — ${i.summary.slice(0,100)}`:""}`).join(" / ") || "لا يوجد"}`;

    const prompt = `اكتب تقريراً احترافياً بعنوان "${suggestion.title}" لجمهور: ${suggestion.audience}.
الفائدة المستهدفة: ${suggestion.benefit}.
الوصف: ${suggestion.description}.

استخدم البيانات الفعلية التالية:
${summary}

اكتب التقرير بأسلوب رسمي عربي، مع أرقام دقيقة ودلالات معنوية.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "أنت كاتب تقارير مالية واستراتيجية للجمعيات الخيرية. تردّ بـJSON فقط عبر استدعاء الأداة." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_report",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                executive_summary: { type: "string", description: "ملخص تنفيذي 3-5 أسطر" },
                key_metrics: {
                  type: "array",
                  items: { type: "object", properties: {
                    label: { type: "string" }, value: { type: "string" }, note: { type: "string" }
                  }, required: ["label","value"] }
                },
                sections: {
                  type: "array",
                  items: { type: "object", properties: {
                    heading: { type: "string" },
                    body: { type: "string", description: "فقرات نصية، يمكن فصل الفقرات بـ \\n\\n" },
                    bullets: { type: "array", items: { type: "string" } }
                  }, required: ["heading","body"] }
                },
                conclusion: { type: "string" },
              },
              required: ["title","executive_summary","key_metrics","sections","conclusion"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_report" } },
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
    const report = args ? JSON.parse(args) : null;
    if (!report) return new Response(JSON.stringify({ error: "empty_report" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({
      report,
      meta: {
        org_name: orgName,
        suggestion_title: suggestion.title,
        category: suggestion.category,
        audience: suggestion.audience,
        totals: { donations: totalDon, expenses: totalExp, allocated: totalAlloc, fully_spent_donors: fullySpentCount, donors: donors.length },
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});