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

const SYSTEM_PROMPT = `أنت خبير تشغيلي متخصص في برامج التنمية الموارد للجمعيات الخيرية والمبرّات الاستثمارية في السعودية.

مهمتك الجوهرية:
- اقرأ الملف بعمق وحدد الهدف الحقيقي للملف (مثلاً: "استقطاع جزء من رواتب الموظفين لصالح المبرة" أو "تنمية المتبرعين الشهريين" أو "استرداد المتبرعين المنقطعين"). الهدف الحقيقي ليس "تعزيز الأداء" أو "تحقيق الاستدامة"، بل هدف تشغيلي محدد بالكمية والفئة.
- ابنِ خطة عملية جدًا تخدم هذا الهدف بشكل مباشر، بحيث كل نشاط له معنى واضح ويُسهم مباشرة في تحقيق الهدف (مثلاً: زيادة عدد المستقطعين من X إلى Y، رفع متوسط الاستقطاع، تقليل نسبة الانقطاع).

قواعد صارمة لجودة الخطة:
1. لا تستخدم كلامًا نظريًا فضفاضًا مثل: "نسبة إنجاز"، "إنجاز استدامة"، "مخرج موثق"، "تجربة استدامة"، "تعزيز الأداء"، "بناء خط أساس". هذه عبارات ممنوعة لأنها لا تعني شيئًا تشغيليًا.
2. الأنشطة يجب أن تكون أفعالًا تشغيلية محددة لها مكان وزمان وفئة مستهدفة. أمثلة جيدة لخطة استقطاع:
   - "حملة توعية داخلية للموظفين الجدد للتسجيل في الاستقطاع الشهري"
   - "تواصل مباشر مع 200 موظف غير مشترك عبر مديري الإدارات"
   - "إطلاق خيار رفع مبلغ الاستقطاع للمشتركين الحاليين عبر رسالة نصية"
   - "اتفاقية مع 5 جهات حكومية/خاصة جديدة لفتح قناة استقطاع"
   - "متابعة المنقطعين خلال 30 يوم واسترداد 30% منهم"
3. المؤشرات يجب أن تكون أرقامًا قابلة للقياس مرتبطة مباشرة بالهدف (عدد المستقطعين الجدد، إجمالي مبلغ الاستقطاع الشهري بالريال، نسبة استمرارية الاستقطاع، متوسط مبلغ الاستقطاع للموظف). ممنوع "نسبة إنجاز النشاط".
4. المستهدفات أرقام واقعية محددة (مثل: "+150 مستقطع جديد"، "زيادة 25,000 ريال شهريًا"، "احتفاظ 85%"). ليست نسبًا مئوية مبهمة.
5. المخرجات هي نتيجة ملموسة (تقرير أعداد المستقطعين، قائمة الجهات الموقّعة، نسبة التحويل من حملة معينة)، وليست عبارات نظرية.
6. الميزانية واقعية بالريال السعودي ومتناسبة مع طبيعة كل نشاط (حملة رقمية ≠ اتفاقية شراكة ≠ زيارة ميدانية).
7. الفترات الزمنية موزّعة على أرباع/أشهر السنة المحددة بشكل منطقي.
8. كل صف فريد ولا يكرر الآخر. يمنع تكرار نفس النشاط بصياغات مختلفة.
9. استخدم الأعمدة كما هي من المستخدم إن كانت مناسبة، وأضف أعمدة عملية فقط إذا كانت ضرورية للوضوح.
10. أعد JSON عبر استدعاء الأداة فقط. كل خلية مملوءة بقيمة حقيقية محددة.`;

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

    const userPrompt = `بيانات الملف المرفوع من المستخدم:
- اسم الخطة: ${planName}
- اسم الملف الأصلي: ${sourceFilename || "غير محدد"}
- السنة المستهدفة: ${year}
- عدد الأعمدة: ${columns.length} | عدد الصفوف: ${rows.length}

الأعمدة:
${columns.length ? columns.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(لا أعمدة محددة)"}

عينة الصفوف:
${sampleRows.length ? JSON.stringify(sampleRows, null, 2) : "(لا توجد صفوف)"}

الخطوات المطلوبة منك:
1) حدّد الهدف الحقيقي للملف بدقة عالية (مثل: "زيادة عدد الموظفين المستقطعين شهريًا لصالح المبرة الاستثمارية والحفاظ على المستقطعين الحاليين"). لا تكتفِ باسم الملف، استخرج النية الفعلية.
2) ضع خطة من 10 إلى 14 نشاط تشغيلي محدد ومتنوع يخدم هذا الهدف مباشرة (استقطاب جدد + احتفاظ بالحاليين + رفع متوسط المبلغ + شراكات جديدة + متابعة المنقطعين + تقارير).
3) كل خلية تحتوي قيمة محددة وقابلة للتنفيذ. ممنوع منعًا باتًا الكلام النظري الفضفاض المذكور في تعليمات النظام.
4) استدعِ الأداة build_operational_plan فقط.`;

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

function buildColumns(input: unknown) {
  const preferred = ["النشاط التشغيلي", "الفئة المستهدفة", "المسؤول", "الفترة الزمنية", "مؤشر القياس", "المستهدف الكمي", "الميزانية (ريال)", "المخرج الملموس"];
  const parsed = Array.isArray(input) ? input.map(cleanText).filter(Boolean) : [];
  const merged = [...parsed, ...preferred].filter((item, index, arr) => arr.indexOf(item) === index);
  return merged.slice(0, Math.max(8, Math.min(merged.length, 12)));
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
  const quarter = `الربع ${Math.floor(index / 3) + 1} ${ctx.year}`;

  const payrollActivities = [
    { a: "تعريف الموظفين الجدد بخيار الاستقطاع الشهري ضمن جلسة التهيئة", t: "تسجيل 40 موظف جديد", k: "عدد المستقطعين الجدد", o: "قائمة بأسماء المستقطعين الجدد + مبالغهم", who: "إدارة الموارد البشرية", b: 6000 },
    { a: "حملة تواصل مباشر مع 200 موظف غير مشترك عبر مديري الإدارات", t: "تحويل 25% منهم لمشتركين", k: "نسبة التحويل من غير مشترك إلى مشترك", o: "تقرير حملة + قائمة المسجلين", who: "فريق تنمية الموارد", b: 4000 },
    { a: "إطلاق رسالة SMS لرفع مبلغ الاستقطاع للمشتركين الحاليين", t: "رفع المبلغ لـ150 مشترك", k: "إجمالي الزيادة الشهرية بالريال", o: "تقرير الزيادة الشهرية", who: "فريق تنمية الموارد", b: 2500 },
    { a: "توقيع اتفاقيات استقطاع مع 5 جهات حكومية/خاصة جديدة", t: "5 جهات + 300 موظف", k: "عدد الاتفاقيات الموقّعة وعدد المنضمين", o: "نسخ الاتفاقيات + قوائم المنضمين", who: "إدارة الشراكات", b: 15000 },
    { a: "متابعة المنقطعين خلال 30 يوم واسترداد جزء منهم", t: "استرداد 30% من المنقطعين", k: "نسبة الاسترداد الشهرية", o: "تقرير شهري بالاسترداد", who: "خدمة المتبرعين", b: 5000 },
    { a: "تصميم برنامج تكريم سنوي للمستقطعين المستمرين أكثر من سنة", t: "تكريم 100 مستقطع وفي", k: "نسبة الاحتفاظ السنوية", o: "حفل تكريم + هدايا رمزية", who: "إدارة العلاقات", b: 25000 },
    { a: "تقارير شهرية لكل إدارة بعدد ومبلغ مستقطعيها", t: "12 تقرير شهري", k: "عدد التقارير المُرسلة وقيمتها", o: "تقرير شهري لوحة قيادة", who: "إدارة البيانات", b: 1500 },
    { a: "حملة رقمية على القنوات الداخلية للتعريف بأثر الاستقطاع", t: "وصول 100% من الموظفين", k: "نسبة التفاعل والمشاهدة", o: "تقرير الحملة الرقمية", who: "إدارة الإعلام", b: 8000 },
    { a: "ورشة عمل مع المديرين لشرح دورهم في تشجيع فرقهم على الاستقطاع", t: "حضور 30 مدير", k: "عدد المديرين المشاركين", o: "محضر الورشة + خطة كل مدير", who: "إدارة التطوير", b: 3500 },
    { a: "إطلاق خيار الاستقطاع الإلكتروني الذاتي عبر بوابة الموظف", t: "تشغيل البوابة + 200 تسجيل ذاتي", k: "عدد التسجيلات الذاتية", o: "بوابة جاهزة + تقرير الاستخدام", who: "إدارة التقنية", b: 18000 },
    { a: "دراسة استبيان لقياس رضا المستقطعين وأسباب الانقطاع", t: "ردود من 60% من المستقطعين", k: "معدل الرضا ونسبة المشاركة", o: "تقرير تحليلي بالاستبيان", who: "إدارة الجودة", b: 4500 },
    { a: "إعداد تقرير سنوي شفاف عن مصارف مبالغ الاستقطاع", t: "تقرير منشور لجميع المستقطعين", k: "نسبة فتح/قراءة التقرير", o: "تقرير الأثر السنوي", who: "إدارة المالية", b: 7000 },
  ];
  const generic = [
    { a: "تحديد الفئة المستهدفة وحجمها بدقة", t: "قاعدة بيانات بـ500 سجل", k: "عدد السجلات في القاعدة", o: "ملف قاعدة البيانات", who: "إدارة البيانات", b: 4000 },
    { a: "إطلاق حملة تواصل مباشرة مع الفئة", t: "وصول 80% من الفئة", k: "عدد المتواصل معهم", o: "تقرير الحملة", who: "فريق التواصل", b: 8000 },
    { a: "عقد شراكات مع 3 جهات داعمة", t: "3 شراكات موقّعة", k: "عدد الشراكات", o: "نسخ الاتفاقيات", who: "إدارة الشراكات", b: 12000 },
    { a: "متابعة المنفذ منهم بعد 30 يوم لقياس الاستمرارية", t: "استمرارية 75%", k: "نسبة الاستمرارية", o: "تقرير المتابعة", who: "فريق المتابعة", b: 5000 },
    { a: "إعداد تقرير ربعي بالنتائج الكمية", t: "4 تقارير سنوية", k: "عدد التقارير", o: "تقارير ربعية", who: "إدارة التخطيط", b: 3000 },
  ];
  const list = isPayroll ? payrollActivities : generic;
  const item = list[index % list.length];

  if (/نشاط|المهمة|العمل|الفعالية/.test(col)) return item.a;
  if (/هدف|غاية|فئة/.test(col)) return isPayroll ? "موظفو الجهات الحكومية والخاصة" : "الفئة المستهدفة من الخطة";
  if (/مسؤول|مالك|منفذ|إدارة/.test(col)) return item.who;
  if (/زمن|تاريخ|فترة|موعد|جدول/.test(col)) return quarter;
  if (/مؤشر|قياس|kpi/i.test(col)) return item.k;
  if (/مستهدف|هدف كمي/.test(col)) return item.t;
  if (/ميزانية|تكلفة|مبلغ/.test(col)) return `${item.b.toLocaleString("ar-SA")} ريال`;
  if (/مخرج|نتيجة|أثر/.test(col)) return item.o;
  if (/حالة|status/i.test(col)) return "مخطط";
  return item.a;
}