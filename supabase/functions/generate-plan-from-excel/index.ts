// Edge function: generate-plan-from-excel
// Takes an uploaded Excel plan (columns + rows + plan name) and generates
// a complete, professional operational plan using Lovable AI.
// Smart: even with sparse data, it infers the goal and builds a coherent plan.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KFAAH_AI_URL = (Deno.env.get("KFAAH_AI_CHAT_URL") || "http://127.0.0.1:11434/v1/chat/completions");

interface RequestBody {
  excel_plan_id?: string;
  plan_name?: string;
  year?: number;
  columns?: string[];
  rows?: Record<string, any>[];
  source_filename?: string;
}

const SYSTEM_PROMPT = `أنت خبير تشغيلي متخصص في برامج تنمية الموارد للجمعيات الخيرية والمبرّات الاستثمارية في السعودية.

مهمتك: تستلم بيانات ملف Excel وتبني خطة تشغيلية متكاملة بالبنية الهرمية المعتمدة في النظام:

البنية الإلزامية (نفس بنية الخطط التشغيلية في النظام):
الهدف/البرنامج الرئيسي ← المبادرة الرئيسية ← المبادرة الفرعية (اختيارية) ← النشاط ← مسؤول التنفيذ ← المستهدف السنوي (رقم) ← التكلفة التقديرية (ريال)

الأعمدة المطلوبة بالترتيب الإلزامي (استخدم هذه الأسماء حرفيًا):
1. "الهدف الاستراتيجي"  — الهدف العام أو البرنامج الرئيسي (يتكرر لكل أنشطته)
2. "المبادرة الرئيسية"  — تحت كل هدف، تتكرر لكل أنشطتها
3. "المبادرة الفرعية"  — اختيارية، اتركها فارغة إن لم تكن مناسبة
4. "النشاط"  — فعل تشغيلي محدد وقابل للتنفيذ
5. "مسؤول التنفيذ"  — اسم الإدارة/الفريق المسؤول
6. "المستهدف السنوي"  — رقم واضح فقط (مثل: 150 مستقطع جديد، 25000 ريال شهري إضافي، 5 شراكات)
7. "التكلفة التقديرية (ريال)"  — رقم بالريال السعودي

قواعد صارمة لجودة المحتوى:
- استنتج الهدف الحقيقي للملف بدقة (مثل: "زيادة عدد الموظفين المستقطعين من رواتبهم لصالح المبرة الاستثمارية"). ليس عبارة نظرية مثل "تعزيز الأداء" أو "تحقيق الاستدامة".
- اقترح 2-4 أهداف/برامج رئيسية ذات صلة، تحت كل هدف 2-3 مبادرات، تحت كل مبادرة 1-3 أنشطة. الإجمالي 10-15 صف.
- النشاط فعل تشغيلي محدد له فئة مستهدفة. أمثلة جيدة:
  • "تواصل مباشر مع 200 موظف غير مشترك عبر مديري الإدارات"
  • "إطلاق خيار رفع مبلغ الاستقطاع للمشتركين عبر رسالة نصية"
  • "توقيع اتفاقية استقطاع مع 5 جهات حكومية جديدة"
  • "متابعة المنقطعين خلال 30 يوم لاسترداد جزء منهم"
- ممنوع منعًا باتًا العبارات الفضفاضة: "نسبة إنجاز"، "مخرج موثق"، "تعزيز"، "بناء خط أساس"، "تحقيق الاستدامة".
- المستهدف السنوي رقم محدد فقط، لا تكتبه نسبة مئوية مبهمة.
- التكلفة التقديرية رقم واقعي متناسب مع طبيعة النشاط (حملة رقمية ≠ شراكة ≠ تكريم).
- لا تكرر نفس النشاط بصياغات مختلفة. كل صف فريد.
- كرّر قيم "الهدف الاستراتيجي" و"المبادرة الرئيسية" في الصفوف التابعة لها (الترتيب يجب أن يجمع أنشطة كل مبادرة معًا).
- أعد JSON عبر استدعاء الأداة فقط.`;

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
          minItems: 7,
          maxItems: 8,
          items: { type: "string" },
          description: "أسماء الأعمدة الإلزامية بالترتيب: الهدف الاستراتيجي، المبادرة الرئيسية، المبادرة الفرعية، النشاط، مسؤول التنفيذ، المستهدف السنوي، التكلفة التقديرية (ريال)",
        },
        rows: {
          type: "array",
          minItems: 10,
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
    const KFAAH_AI_API_KEY = Deno.env.get("KFAAH_AI_API_KEY");
    if (!KFAAH_AI_API_KEY) {
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

    const userPrompt = `بيانات الملف المرفوع من المستخدم:
- اسم الخطة: ${planName}
- اسم الملف الأصلي: ${sourceFilename || "غير محدد"}
- السنة المستهدفة: ${year}
- عدد الأعمدة: ${columns.length} | عدد الصفوف: ${rows.length}

الأعمدة:
${columns.length ? columns.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(لا أعمدة محددة)"}

عينة الصفوف:
${sampleRows.length ? JSON.stringify(sampleRows, null, 2) : "(لا توجد صفوف)"}

الخطوات المطلوبة:
1) حدّد الهدف الحقيقي للملف بدقة (مثل: "زيادة عدد المستقطعين من رواتبهم لصالح المبرة والحفاظ على الحاليين").
2) ابنِ خطة هرمية: 2-4 أهداف استراتيجية، تحت كل هدف 2-3 مبادرات، تحت كل مبادرة 1-3 أنشطة. الإجمالي 10-15 صف.
3) استخدم الأعمدة الإلزامية بالترتيب المذكور في تعليمات النظام بالضبط.
4) رتّب الصفوف بحيث تتجمع أنشطة كل مبادرة معًا، وأنشطة كل هدف معًا.
5) كل خلية بقيمة حقيقية محددة. ممنوع العبارات النظرية.
6) استدعِ الأداة build_operational_plan فقط.`;

    const aiResp = await fetch(KFAAH_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KFAAH_AI_API_KEY}`,
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

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function inferGoal(planName: string, sourceFilename: string, columns: string[], rows: Record<string, any>[]) {
  const source = [planName, sourceFilename, ...columns, ...rows.slice(0, 3).flatMap((row) => Object.values(row).map(String))]
    .join(" ");
  const text = source.toLowerCase();
  if (/استقطاع|مستقطع|راتب|payroll/i.test(source)) {
    return "زيادة عدد الموظفين المستقطعين شهريًا لصالح المبرة والحفاظ على المستقطعين الحاليين ورفع متوسط مبلغ الاستقطاع";
  }
  if (/متبرع|تبرع|donor|fundraising/i.test(source)) {
    return "تنمية قاعدة المتبرعين الشهريين وزيادة الإيرادات التشغيلية المستدامة";
  }
  if (/يتيم|أيتام/.test(source)) return "كفالة وتأهيل الأيتام بأثر تنموي ملموس على المستفيدين";
  const clean = source.replace(/[_\-.]+/g, " ").trim();
  return clean ? `تحقيق ${clean.slice(0, 80)} بأهداف كمية محددة` : "تحقيق نمو تشغيلي بأهداف كمية محددة وأنشطة تنفيذية واضحة";
}

function buildColumns(_input: unknown) {
  // البنية الإلزامية الموحّدة
  return [
    "الهدف الاستراتيجي",
    "المبادرة الرئيسية",
    "المبادرة الفرعية",
    "النشاط",
    "مسؤول التنفيذ",
    "المستهدف السنوي",
    "التكلفة التقديرية (ريال)",
  ];
}

function normalizeRows(input: unknown, cols: string[], ctx: { goal: string; year: number; planName: string }) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => fillMissingCells(row as Record<string, unknown>, cols, ctx, index))
    .filter((row) => Object.values(row).some((value) => cleanText(value).length > 0));
}

function fillMissingCells(row: Record<string, unknown>, cols: string[], ctx: { goal: string; year: number; planName: string }, index: number) {
  const filled: Record<string, string> = {};
  for (const col of cols) {
    filled[col] = cleanText(row[col]) || fallbackValue(col, index, ctx);
  }
  return filled;
}

function buildSmartRows(cols: string[], ctx: { goal: string; year: number; planName: string }, existing: Record<string, string>[]) {
  const rows = [...existing];
  while (rows.length < 10) {
    rows.push(fillMissingCells({}, cols, ctx, rows.length));
  }
  return rows;
}

function fallbackValue(col: string, index: number, ctx: { goal: string; year: number; planName: string }) {
  const isPayroll = /استقطاع|مستقطع|راتب/i.test(`${ctx.goal} ${ctx.planName}`);

  const payrollActivities = [
    { g: "استقطاب مستقطعين جدد", i: "حملات داخلية للموظفين", s: "تعريف الموظفين الجدد", a: "تقديم خيار الاستقطاع ضمن جلسة تهيئة الموظفين الجدد", who: "إدارة الموارد البشرية", t: "40 موظف جديد", b: 6000 },
    { g: "استقطاب مستقطعين جدد", i: "حملات داخلية للموظفين", s: "تواصل مع غير المشتركين", a: "تواصل مباشر مع 200 موظف غير مشترك عبر مديري الإدارات", who: "فريق تنمية الموارد", t: "تحويل 50 موظف", b: 4000 },
    { g: "استقطاب مستقطعين جدد", i: "توسيع الشراكات الخارجية", s: "اتفاقيات استقطاع جديدة", a: "توقيع اتفاقيات استقطاع مع جهات حكومية وخاصة جديدة", who: "إدارة الشراكات", t: "5 اتفاقيات و300 منضم", b: 15000 },
    { g: "استقطاب مستقطعين جدد", i: "توسيع الشراكات الخارجية", s: "", a: "إطلاق بوابة استقطاع إلكترونية للتسجيل الذاتي", who: "إدارة التقنية", t: "200 تسجيل ذاتي", b: 18000 },
    { g: "الاحتفاظ بالمستقطعين الحاليين", i: "متابعة المنقطعين", s: "استرداد المنقطعين", a: "متابعة المنقطعين خلال 30 يوم لاسترداد جزء منهم", who: "خدمة المتبرعين", t: "استرداد 90 منقطع", b: 5000 },
    { g: "الاحتفاظ بالمستقطعين الحاليين", i: "تكريم وولاء المستقطعين", s: "", a: "حفل تكريم سنوي للمستقطعين المستمرين أكثر من سنة", who: "إدارة العلاقات", t: "تكريم 100 مستقطع", b: 25000 },
    { g: "الاحتفاظ بالمستقطعين الحاليين", i: "تكريم وولاء المستقطعين", s: "قياس الرضا", a: "استبيان دوري لقياس رضا المستقطعين وأسباب الانقطاع", who: "إدارة الجودة", t: "ردود 60% من المستقطعين", b: 4500 },
    { g: "رفع متوسط مبلغ الاستقطاع", i: "تحفيز رفع المبالغ", s: "حملات SMS", a: "إطلاق حملة SMS لرفع مبلغ الاستقطاع للمشتركين الحاليين", who: "فريق تنمية الموارد", t: "رفع المبلغ لـ150 مشترك", b: 2500 },
    { g: "رفع متوسط مبلغ الاستقطاع", i: "تحفيز رفع المبالغ", s: "ورش مع المديرين", a: "ورشة عمل مع المديرين لتشجيع فرقهم على رفع الاستقطاع", who: "إدارة التطوير", t: "حضور 30 مدير", b: 3500 },
    { g: "الشفافية والمتابعة", i: "تقارير وقياس الأثر", s: "", a: "تقارير شهرية لكل إدارة بعدد ومبلغ مستقطعيها", who: "إدارة البيانات", t: "12 تقرير شهري", b: 1500 },
    { g: "الشفافية والمتابعة", i: "تقارير وقياس الأثر", s: "", a: "إعداد تقرير سنوي شفاف عن مصارف مبالغ الاستقطاع", who: "إدارة المالية", t: "تقرير سنوي منشور", b: 7000 },
    { g: "الشفافية والمتابعة", i: "حملات تعريفية", s: "", a: "حملة رقمية داخلية للتعريف بأثر الاستقطاع على المستفيدين", who: "إدارة الإعلام", t: "وصول 100% من الموظفين", b: 8000 },
  ];
  const generic = [
    { g: ctx.goal, i: "بناء قاعدة البيانات", s: "", a: "تحديد الفئة المستهدفة وحجمها وبناء قاعدة بياناتها", who: "إدارة البيانات", t: "500 سجل", b: 4000 },
    { g: ctx.goal, i: "حملات التواصل", s: "", a: "إطلاق حملة تواصل مباشرة مع الفئة المستهدفة", who: "فريق التواصل", t: "وصول 80% من الفئة", b: 8000 },
    { g: ctx.goal, i: "الشراكات الداعمة", s: "", a: "عقد شراكات مع 3 جهات داعمة لخدمة الهدف", who: "إدارة الشراكات", t: "3 شراكات موقّعة", b: 12000 },
    { g: ctx.goal, i: "المتابعة والاستمرارية", s: "", a: "متابعة المنفذ منهم بعد 30 يوم لقياس الاستمرارية", who: "فريق المتابعة", t: "استمرارية 75%", b: 5000 },
    { g: ctx.goal, i: "التقارير والقياس", s: "", a: "إعداد تقرير ربعي بالنتائج الكمية", who: "إدارة التخطيط", t: "4 تقارير سنوية", b: 3000 },
  ];
  const list = isPayroll ? payrollActivities : generic;
  const item = list[index % list.length];

  if (/الهدف الاستراتيجي|^هدف|برنامج/.test(col)) return item.g;
  if (/المبادرة الفرعية|فرعية/.test(col)) return item.s;
  if (/المبادرة|مبادرة/.test(col)) return item.i;
  if (/نشاط/.test(col)) return item.a;
  if (/مسؤول|منفذ/.test(col)) return item.who;
  if (/المستهدف السنوي|مستهدف/.test(col)) return item.t;
  if (/تكلفة|ميزانية|مبلغ/.test(col)) return `${item.b.toLocaleString("ar-SA")}`;
  return item.a;
}