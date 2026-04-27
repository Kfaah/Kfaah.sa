// Edge function: generate-plan-from-excel
// Takes an uploaded Excel plan (columns + rows + plan name) and generates
// a complete, professional operational plan using Lovable AI.
// Smart: even with sparse data, it infers the goal and builds a coherent plan.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface RequestBody {
  excel_plan_id?: string;
  plan_name?: string;
  year?: number;
  columns?: string[];
  rows?: Record<string, any>[];
  source_filename?: string;
}

const SYSTEM_PROMPT = `أنت خبير استراتيجي وتشغيلي لجمعيات ومنظمات غير ربحية في السعودية.
مهمتك: تستلم بيانات خطة (قد تكون شحيحة أو ناقصة من ملف Excel)، وتبني خطة تشغيلية كاملة احترافية ومنطقية.

قواعد ذكية صارمة:
1. حتى لو كانت البيانات قليلة جداً (سطر واحد أو عمود واحد)، استنتج الهدف العام من اسم الخطة، اسم الملف، ورؤوس الأعمدة، والصفوف الموجودة.
2. ابنِ خطة عملية متكاملة من 8-15 صف نشاط واضح وقابل للتنفيذ، بحيث يخدم كل صف الهدف الواضح.
3. استخدم نفس أعمدة المستخدم إن كانت كافية، أو وسّعها بأعمدة احترافية إضافية مناسبة (مثل: النشاط، الهدف الفرعي، المسؤول، الجدول الزمني، المؤشر، المستهدف، الميزانية المقدرة، المخرجات، الحالة).
4. اكتب القيم بالعربية الفصحى، الأرقام والتواريخ واضحة.
5. الميزانية بالريال السعودي. التواريخ خلال السنة المحددة.
6. لا تترك أي خلية فارغة — املأ كل خلية بقيمة منطقية حقيقية.
7. استرجع JSON صالح فقط عبر استدعاء الأداة، لا تكتب أي شرح خارج الأداة.`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "build_operational_plan",
    description: "بناء خطة تشغيلية كاملة مع أعمدة وصفوف",
    parameters: {
      type: "object",
      properties: {
        inferred_goal: {
          type: "string",
          description: "الهدف العام المستنتج من البيانات",
        },
        plan_summary: {
          type: "string",
          description: "ملخص قصير (سطر واحد) يصف الخطة المقترحة",
        },
        columns: {
          type: "array",
          minItems: 8,
          items: { type: "string" },
          description: "أسماء الأعمدة بالعربية بالترتيب",
        },
        rows: {
          type: "array",
          minItems: 8,
          maxItems: 15,
          description: "صفوف الخطة، كل صف هو كائن مفاتيحه أسماء الأعمدة",
          items: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      },
      required: ["inferred_goal", "plan_summary", "columns", "rows"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI service not configured" }, 500);
    }

    const body = (await req.json()) as RequestBody;
    const planName = (body.plan_name || "").trim() || "خطة تشغيلية";
    const year = body.year || new Date().getFullYear();
    const columns = Array.isArray(body.columns) ? body.columns : [];
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const sourceFilename = body.source_filename || "";

    // Truncate to keep prompt small
    const sampleRows = rows.slice(0, 40);

    const userPrompt = `بيانات الملف المرفوع:
- اسم الخطة: ${planName}
- اسم الملف الأصلي: ${sourceFilename || "غير محدد"}
- السنة: ${year}
- عدد الأعمدة: ${columns.length}
- عدد الصفوف: ${rows.length}

الأعمدة الموجودة:
${columns.length ? columns.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(لا أعمدة محددة)"}

عينة من الصفوف (أول ${sampleRows.length}):
${
      sampleRows.length
        ? JSON.stringify(sampleRows, null, 2)
        : "(لا توجد صفوف)"
    }

المطلوب:
- استنتج الهدف العام من هذه البيانات (حتى لو شحيحة جداً، استخدم اسم الخطة واسم الملف).
- أنشئ خطة تشغيلية احترافية كاملة من 8 إلى 15 صف نشاط لخدمة هذا الهدف.
- استخدم أعمدة مناسبة (وسّع الأعمدة إن لزم) واملأ كل خلية بقيمة حقيقية منطقية.
- استدعِ الأداة build_operational_plan فقط.`;

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 8192,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: {
          type: "function",
          function: { name: "build_operational_plan" },
        },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      if (aiResp.status === 429) {
        return json(
          { error: "تم تجاوز حد الطلبات، حاول بعد قليل" },
          429,
        );
      }
      if (aiResp.status === 402) {
        return json(
          { error: "نفدت الأرصدة، أضف رصيد من إعدادات الـ Workspace" },
          402,
        );
      }
      return json({ error: "فشل استدعاء خدمة الذكاء الاصطناعي" }, 500);
    }

    const data = await aiResp.json();
    const choice = data?.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];
    console.log("AI finish_reason:", choice?.finish_reason);
    console.log("AI usage:", JSON.stringify(data?.usage));
    if (!toolCall?.function?.arguments) {
      console.error("No tool call returned. finish_reason:", choice?.finish_reason);
      console.error("Message:", JSON.stringify(choice?.message)?.slice(0, 1000));
      return json({ error: "لم يتم توليد خطة صالحة (لا يوجد tool call)" }, 500);
    }
    console.log("Tool args length:", toolCall.function.arguments.length);

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args:", e);
      console.error("Raw args:", toolCall.function.arguments?.slice(0, 2000));
      return json({ error: "تعذّر تحليل خرج الذكاء الاصطناعي (JSON غير مكتمل — قد يكون تم بلوغ حد الإخراج)" }, 500);
    }
    console.log("Parsed columns:", parsed?.columns?.length, "rows:", parsed?.rows?.length);

    const inferredGoal = cleanText(parsed.inferred_goal) || inferGoal(planName, sourceFilename, columns, rows);
    const outColumns = buildColumns(parsed.columns);
    let outRows = normalizeRows(parsed.rows, outColumns, { goal: inferredGoal, year, planName });

    if (outRows.length < 8) {
      console.warn("AI returned too few usable rows; completing with smart fallback rows", outRows.length);
      outRows = buildSmartRows(outColumns, { goal: inferredGoal, year, planName }, outRows);
    }

    outRows = outRows.slice(0, 15).map((row, index) => fillMissingCells(row, outColumns, { goal: inferredGoal, year, planName }, index));

    return json({
      inferred_goal: inferredGoal,
      plan_summary: parsed.plan_summary || "",
      columns: outColumns,
      rows: outRows,
    });
  } catch (err) {
    console.error("generate-plan-from-excel error:", err);
    return json({ error: err instanceof Error ? err.message : "خطأ غير متوقع" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}