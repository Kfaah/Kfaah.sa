const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface Row { id: string; description: string; amount?: number; vendor?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { rows, projects } = await req.json() as { rows: Row[]; projects: string[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ classifications: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const projectList = (projects || []).slice(0, 50).join(" | ") || "(لا توجد مشاريع مسجلة)";
    const prompt = `أنت محلل مالي لجمعية خيرية. لكل مصروف، حدد:
- kind: واحدة من project | marketing | operational
- project_name: اسم المشروع من قائمة الجمعية إن أمكن، وإلا null

قائمة مشاريع الجمعية المسجلة:
${projectList}

المصروفات المراد تصنيفها:
${rows.map((r, i) => `${i + 1}. وصف: "${r.description}" | المورد: "${r.vendor || ""}" | المبلغ: ${r.amount || ""}`).join("\n")}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت مساعد محاسبي دقيق لجمعية خيرية تردّ بـJSON فقط عبر استدعاء الأداة." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_expenses",
            description: "Classify each expense row.",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "integer" },
                      kind: { type: "string", enum: ["project", "marketing", "operational"] },
                      project_name: { type: ["string", "null"] },
                      confidence: { type: "number" },
                    },
                    required: ["index", "kind"],
                  },
                },
              },
              required: ["classifications"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "classify_expenses" } },
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
    const parsed = args ? JSON.parse(args) : { classifications: [] };
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});