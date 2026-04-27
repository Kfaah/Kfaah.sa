// Edge function: generate-plan-deep
// Deep AI-powered operational plan generation.
// Studies: organization data + uploaded reference files + previous plans + tasks
// Produces: a complete, professional operational plan saved as an excel_plan.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// --- Relevance gate prompt ---
const RELEVANCE_SYSTEM = `أنت مدقّق ملفات لخطة تشغيلية لجمعية خيرية.
مهمتك: تحديد ما إذا كان الملف ذا صلة بالتخطيط التشغيلي للجمعية أم لا.

يُعتبر الملف "ذا صلة" إذا كان يحتوي على واحد مما يلي:
- خطط استراتيجية أو تشغيلية سابقة
- أهداف ومبادرات وأنشطة
- ميزانيات ومستهدفات وبرامج
- تقارير أداء أو إحصائيات الجمعية
- لوائح / سياسات / منهجيات عمل
- بيانات الموظفين أو الإدارات أو الشركاء
- دراسات احتياج، مستفيدين، تأثير اجتماعي

يُعتبر "غير ذي صلة" إذا كان:
- صور شخصية، صور غير مرتبطة، شعارات فقط
- إيصالات شراء، فواتير فردية، كشوف بنكية شخصية
- ملفات عشوائية، نصوص لا علاقة لها بعمل الجمعيات
- محتوى ترفيهي، شخصي، أو تجاري لا صلة له
- صور سيلفي، ميمز، محادثات عامة

يجب أن تستدعي الأداة classify_file وترجع التصنيف فقط.`;

const classifyTool = {
  type: "function",
  function: {
    name: "classify_file",
    description: "تصنيف ملف من حيث صلته بخطة تشغيلية لجمعية خيرية",
    parameters: {
      type: "object",
      properties: {
        is_relevant: { type: "boolean", description: "هل الملف ذو صلة بالخطة التشغيلية؟" },
        category: {
          type: "string",
          description: "تصنيف موجز للمحتوى (مثال: خطة سابقة، إيصال شراء، صورة شخصية، تقرير أداء...)",
        },
        reason: {
          type: "string",
          description: "سبب القرار في جملة واحدة عربية واضحة",
        },
      },
      required: ["is_relevant", "category", "reason"],
      additionalProperties: false,
    },
  },
};

async function classifyFileRelevance(
  apiKey: string,
  fileName: string,
  textPreview: string | null,
  imageDataUrl: string | null,
): Promise<{ is_relevant: boolean; category: string; reason: string }> {
  const userParts: any[] = [
    {
      type: "text",
      text: `اسم الملف: ${fileName}\n\n${textPreview ? `معاينة المحتوى النصي:\n${textPreview.slice(0, 4000)}` : "(لا يوجد محتوى نصي مستخرج — اعتمد على الاسم والصورة إن وجدت)"}`,
    },
  ];
  if (imageDataUrl) {
    userParts.push({ type: "image_url", image_url: { url: imageDataUrl } });
  }

  const resp = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: RELEVANCE_SYSTEM },
        { role: "user", content: userParts },
      ],
      tools: [classifyTool],
      tool_choice: { type: "function", function: { name: "classify_file" } },
    }),
  });
  if (!resp.ok) {
    // Fail open: if classifier errors, allow the file but mark unknown
    return { is_relevant: true, category: "غير محدد", reason: "تعذر التصنيف، تم القبول مبدئياً" };
  }
  const j = await resp.json();
  const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return { is_relevant: true, category: "غير محدد", reason: "لا توجد نتيجة تصنيف" };
  try {
    return JSON.parse(args);
  } catch {
    return { is_relevant: true, category: "غير محدد", reason: "صيغة تصنيف غير صالحة" };
  }
}

interface RequestBody {
  plan_name?: string;
  year?: number;
  user_brief?: string; // free-text instructions from the user
  reference_file_paths?: string[]; // storage paths in ai-plan-references bucket
}

const SYSTEM_PROMPT = `أنت خبير استراتيجي وتشغيلي رفيع المستوى متخصص في الجمعيات الخيرية والمبرّات في المملكة العربية السعودية.

مهمتك: دراسة عميقة ودقيقة واحترافية لكل المعطيات المقدّمة (بيانات الجمعية الكاملة + الأهداف الاستراتيجية + المبادرات + الأنشطة السابقة + المهام + الموظفين + أي ملفات مرفقة)، ثم استخراج خطة تشغيلية متكاملة واقعية قابلة للتنفيذ.

اعتمد على:
1. الأهداف الاستراتيجية القائمة في النظام (لا تخترع أهدافاً جديدة إلا إذا كانت ضرورية لسد فجوة).
2. المبادرات السابقة كنقطة انطلاق للتحسين والتطوير.
3. الملفات المرفقة كمراجع مهمة.
4. وضع الجمعية الفعلي وحجمها وعدد موظفيها.

البنية الإلزامية للخطة (استخدم هذه الأسماء حرفياً للأعمدة):
- الهدف الاستراتيجي
- المبادرة الرئيسية
- النشاط
- مسؤول التنفيذ
- المستهدف السنوي
- التكلفة التقديرية (ريال)

قواعد إجبارية:
- عدد صفوف الأنشطة: بين 12 و 25 نشاطاً موزعة على 3-5 أهداف استراتيجية على الأقل.
- "المستهدف السنوي" يجب أن يكون رقماً صحيحاً (بدون فواصل أو رموز).
- "التكلفة التقديرية" يجب أن تكون رقماً صحيحاً بالريال.
- "مسؤول التنفيذ" يجب أن يكون اسم موظف من قائمة الموظفين المرفقة، أو اسم إدارة منطقية إن لم يوجد موظف مناسب.
- لا تكرر نفس النشاط، ولا تضع أنشطة عامة بلا قياس.

يجب أن تستدعي الأداة generate_plan وترجع النتيجة عبرها فقط، بدون أي نص خارج الأداة.`;

const planTool = {
  type: "function",
  function: {
    name: "generate_plan",
    description: "إرجاع خطة تشغيلية متكاملة بصيغة جدول",
    parameters: {
      type: "object",
      properties: {
        executive_summary: {
          type: "string",
          description: "ملخص تنفيذي قصير (3-5 أسطر) يصف الفلسفة العامة للخطة وأبرز محاورها",
        },
        rows: {
          type: "array",
          description: "صفوف الأنشطة في الخطة",
          items: {
            type: "object",
            properties: {
              "الهدف الاستراتيجي": { type: "string" },
              "المبادرة الرئيسية": { type: "string" },
              "النشاط": { type: "string" },
              "مسؤول التنفيذ": { type: "string" },
              "المستهدف السنوي": { type: "string" },
              "التكلفة التقديرية (ريال)": { type: "string" },
            },
            required: [
              "الهدف الاستراتيجي",
              "المبادرة الرئيسية",
              "النشاط",
              "مسؤول التنفيذ",
              "المستهدف السنوي",
              "التكلفة التقديرية (ريال)",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["executive_summary", "rows"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY غير مهيأ");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve organization
    const { data: orgIdRow } = await admin.rpc("get_user_organization_id", { _user_id: user.id });
    const organization_id = orgIdRow as string | null;

    const body: RequestBody = await req.json().catch(() => ({} as RequestBody));
    const planName = (body.plan_name || "خطة تشغيلية مولّدة بالذكاء الاصطناعي").trim();
    const year = body.year ?? new Date().getFullYear();
    const userBrief = (body.user_brief || "").trim();
    const filePaths = Array.isArray(body.reference_file_paths) ? body.reference_file_paths : [];

    // Gather organization context in parallel
    const [orgRow, employeesRow, goalsRow, initiativesRow, prevPlansRow, tasksRow, excelPlansRow] = await Promise.all([
      organization_id ? admin.from("organizations").select("name, slug").eq("id", organization_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from("employees").select("full_name, job_title, department_id").limit(100),
      admin.from("strategic_goals").select("name, description").limit(50),
      admin.from("initiatives").select("name, strategic_goal_id").limit(100),
      admin.from("operational_plans").select("strategic_goal, initiative, activity_name, annual_target, estimated_budget, year").order("created_at", { ascending: false }).limit(60),
      admin.from("tasks").select("title, status, priority").order("created_at", { ascending: false }).limit(40),
      admin.from("excel_plans").select("plan_name, year, columns, rows").order("created_at", { ascending: false }).limit(5),
    ]);

    // Read & classify uploaded reference files. Reject irrelevant ones up-front.
    const fileSummaries: string[] = [];
    const acceptedFiles: string[] = [];
    const rejectedFiles: { path: string; category: string; reason: string }[] = [];

    for (const path of filePaths.slice(0, 10)) {
      try {
        const { data: fileBlob } = await admin.storage.from("ai-plan-references").download(path);
        if (!fileBlob) continue;
        const lower = path.toLowerCase();
        const isText = /\.(txt|md|csv|json|html?)$/.test(lower);
        const isImage = /\.(png|jpe?g|webp|gif)$/.test(lower);

        let textPreview: string | null = null;
        let imageDataUrl: string | null = null;

        if (isText) {
          textPreview = await fileBlob.text();
        } else if (isImage) {
          const buf = new Uint8Array(await fileBlob.arrayBuffer());
          // Cap image size to ~3MB for the classifier
          if (buf.byteLength <= 3 * 1024 * 1024) {
            const b64 = btoa(String.fromCharCode(...buf));
            const mime = lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : lower.endsWith(".gif") ? "image/gif" : "image/jpeg";
            imageDataUrl = `data:${mime};base64,${b64}`;
          }
        }

        const verdict = await classifyFileRelevance(LOVABLE_API_KEY, path, textPreview, imageDataUrl);

        if (!verdict.is_relevant) {
          rejectedFiles.push({ path, category: verdict.category, reason: verdict.reason });
          continue;
        }

        acceptedFiles.push(path);
        if (textPreview) {
          fileSummaries.push(`📄 ${path} [${verdict.category}]\n${textPreview.slice(0, 8000)}`);
        } else {
          fileSummaries.push(`📎 ${path} [${verdict.category}] (ملف ثنائي بحجم ${Math.round(fileBlob.size / 1024)} KB — مقبول كمرجع)`);
        }
      } catch (e) {
        console.error("file read error", path, e);
      }
    }

    // If user uploaded files but ALL were rejected, stop and explain.
    if (filePaths.length > 0 && acceptedFiles.length === 0) {
      return new Response(
        JSON.stringify({
          error: "تم رفض جميع الملفات المرفقة لأنها غير ذات صلة بالخطة التشغيلية للجمعية. يرجى رفع ملفات تتعلق بالخطط أو الأهداف أو التقارير أو السياسات أو بيانات الجمعية.",
          rejected_files: rejectedFiles,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgContext = {
      organization: orgRow?.data || null,
      employees: (employeesRow.data || []).map((e: any) => ({ name: e.full_name, title: e.job_title })),
      strategic_goals: goalsRow.data || [],
      initiatives: initiativesRow.data || [],
      previous_operational_plans: prevPlansRow.data || [],
      recent_tasks: tasksRow.data || [],
      previous_excel_plans: (excelPlansRow.data || []).map((p: any) => ({
        name: p.plan_name,
        year: p.year,
        columns: p.columns,
        sample_rows: Array.isArray(p.rows) ? p.rows.slice(0, 5) : [],
      })),
    };

    const userMessage = `# طلب توليد خطة تشغيلية احترافية

## اسم الخطة المطلوبة
${planName}

## السنة
${year}

## ملاحظات المستخدم
${userBrief || "(لا توجد ملاحظات إضافية — اعتمد كلياً على دراسة المعطيات)"}

## بيانات الجمعية والسياق الكامل
\`\`\`json
${JSON.stringify(orgContext, null, 2)}
\`\`\`

## الملفات المرجعية المرفقة (${fileSummaries.length})
${fileSummaries.length ? fileSummaries.join("\n\n---\n\n") : "(لم يتم رفع ملفات — اعتمد فقط على بيانات الجمعية)"}

قم الآن بدراسة كل ما سبق دراسة عميقة ودقيقة، ثم أنتج خطة تشغيلية متكاملة عبر استدعاء أداة generate_plan.`;

    // Call Lovable AI Gateway
    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [planTool],
        tool_choice: { type: "function", function: { name: "generate_plan" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول بعد قليل." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "الرصيد غير كافٍ في خدمة الذكاء الاصطناعي." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call", JSON.stringify(aiJson).slice(0, 1000));
      return new Response(JSON.stringify({ error: "لم ينتج الذكاء الاصطناعي خطة صالحة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let plan: { executive_summary: string; rows: Record<string, string>[] };
    try {
      plan = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return new Response(JSON.stringify({ error: "خطأ في صيغة الخطة المُولّدة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan.rows?.length) {
      return new Response(JSON.stringify({ error: "الخطة المُولّدة فارغة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const columns = [
      "الهدف الاستراتيجي",
      "المبادرة الرئيسية",
      "النشاط",
      "مسؤول التنفيذ",
      "المستهدف السنوي",
      "التكلفة التقديرية (ريال)",
    ];

    // Persist as excel_plan so it shows up in the Operational Plans page
    const finalName = `${planName} — مولّدة بالذكاء الاصطناعي`;
    const { data: inserted, error: insertErr } = await admin
      .from("excel_plans")
      .insert({
        organization_id,
        user_id: user.id,
        plan_name: finalName,
        year,
        sheet_name: "خطة AI عميقة",
        columns,
        rows: plan.rows,
        source_filename: filePaths.length ? `${filePaths.length} ملف مرجعي` : "توليد بدون ملفات",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("insert error", insertErr);
      return new Response(JSON.stringify({ error: "فشل حفظ الخطة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        excel_plan_id: inserted.id,
        plan_name: finalName,
        rows_count: plan.rows.length,
        executive_summary: plan.executive_summary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-plan-deep fatal", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});