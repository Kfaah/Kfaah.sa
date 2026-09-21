// Deep Organization Analysis
// يدمج: الملفات المرفوعة + ملف التبرعات + الموقع الإلكتروني + المتجر + حسابات التواصل
// يصدر: تقييم شامل + نقاط قوة + فجوات + توصيات + مساءلات للموظفين بحسب الدور

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const AI_MODEL = "openai/gpt-6-astra";

type DigitalSource = {
  id?: string;
  kind: string;
  label: string;
  url: string;
  cachedContent?: string | null;
};

type SourceSnapshot = DigitalSource & {
  status: "تم التحليل" | "تعذر الوصول" | "محتوى غير كافٍ";
  content: string | null;
};

type UploadedDocument = {
  id: string;
  file_name: string;
  detected_schema: string | null;
  status: string | null;
  file_path: string | null;
  ai_analysis: Record<string, unknown> | null;
  ai_analyzed_at: string | null;
  created_at: string;
};

const DOCUMENT_LABELS: Record<string, string> = {
  donations: "ملف تبرعات",
  store_master: "ملف المتجر الشامل",
  store_daily: "تبرعات المتجر اليومية",
  failed_donations: "التبرعات الفاشلة",
  bank_transfers: "التحويلات البنكية",
  abandoned_carts: "السلال المتروكة",
  campaigns: "الحملات",
  subscriptions: "الاستقطاعات والاشتراكات",
  gifts: "الإهداءات",
  staff_duties: "مهام الموظفين",
  policies: "اللوائح والسياسات",
  meeting_minutes: "محاضر الاجتماعات",
  plans: "الخطط",
  reports: "التقارير",
  profiles: "الملفات التعريفية",
  tasks: "المهام",
  other: "ملف آخر",
};

function compactDocumentAnalysis(value: Record<string, unknown> | null) {
  if (!value) return null;
  const compactList = (key: string) => Array.isArray(value[key])
    ? (value[key] as unknown[]).slice(0, 8).map((item) => String(item).slice(0, 500))
    : [];
  return {
    document_type: typeof value.document_type === "string" ? value.document_type.slice(0, 200) : null,
    summary: typeof value.summary === "string" ? value.summary.slice(0, 1800) : null,
    key_points: compactList("key_points"),
    numbers: compactList("numbers"),
    strengths: compactList("strengths"),
    gaps: compactList("gaps"),
    recommendations: compactList("recommendations"),
    suggested_tasks: compactList("suggested_tasks"),
  };
}

const SOURCE_LABELS: Record<string, string> = {
  website: "الموقع الإلكتروني",
  store: "المتجر الإلكتروني",
  twitter: "حساب إكس",
  instagram: "حساب إنستغرام",
  tiktok: "حساب تيك توك",
  snapchat: "حساب سناب شات",
  youtube: "قناة يوتيوب",
  facebook: "صفحة فيسبوك",
  linkedin: "صفحة لينكدإن",
};

function validHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

interface AnalyzeRequest {
  organization_id: string;
  upload_id?: string | null;
  trigger_source?: "manual" | "upload" | "scheduled";
}

async function firecrawlScrape(source: DigitalSource): Promise<SourceSnapshot> {
  const cachedContent = source.cachedContent?.trim() || null;
  if (!FIRECRAWL_API_KEY) {
    return { ...source, status: cachedContent ? "تم التحليل" : "تعذر الوصول", content: cachedContent };
  }
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: source.url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!r.ok) return { ...source, status: cachedContent ? "تم التحليل" : "تعذر الوصول", content: cachedContent };
    const j = await r.json();
    const md =
      j?.markdown ||
      j?.data?.markdown ||
      j?.data?.content ||
      "";
    const content = typeof md === "string" ? md.trim().slice(0, 8000) : "";
    return {
      ...source,
      status: content.length >= 120 ? "تم التحليل" : "محتوى غير كافٍ",
      content: content || cachedContent,
    };
  } catch {
    return { ...source, status: cachedContent ? "تم التحليل" : "تعذر الوصول", content: cachedContent };
  }
}

async function callAI(systemPrompt: string, userPayload: unknown) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(userPayload) }] },
      ],
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`AI gateway error ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = await r.json();
  const content = j?.output_text || j?.output?.flatMap((item: any) => item?.content || []).find((item: any) => item?.type === "output_text")?.text || "{}";
  try {
    const cleaned = String(content).replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return { raw: content };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { organization_id, upload_id = null, trigger_source = "manual" } = body;
  if (!organization_id) {
    return new Response(JSON.stringify({ error: "organization_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1) Resolve user from JWT (for created_by)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  let createdBy: string | null = null;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    createdBy = data?.user?.id ?? null;
  }

  // 2) Create analysis row (running)
  const { data: analysisRow, error: insErr } = await admin
    .from("deep_analyses")
    .insert({
      organization_id,
      trigger_source,
      upload_id,
      status: "running",
      created_by: createdBy,
      ai_model: AI_MODEL,
    })
    .select()
    .single();

  if (insErr || !analysisRow) {
    return new Response(
      JSON.stringify({ error: "failed_to_create_analysis", details: insErr }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // The full analysis takes several minutes, well past the 150s request idle
  // timeout, so it runs in the background and the client polls deep_analyses.
  const runAnalysis = async () => {
  try {
    // 3) Load org + profile + employees + donations summary
    const [orgRes, profRes, empRes, donAggRes, campRes, externalRes, uploadsRes] = await Promise.all([
      admin.from("organizations").select("id,name,slug").eq("id", organization_id).maybeSingle(),
      admin.from("organization_profiles").select("*").eq("organization_id", organization_id).maybeSingle(),
      admin.from("employees").select("id,full_name,job_role,role_level").eq("organization_id", organization_id),
      admin.from("donations")
        .select("amount, donation_date, project_name, donor_id, status")
        .eq("organization_id", organization_id)
        .limit(2000),
      admin.from("campaigns").select("id,name,status,goal_amount,collected_amount,start_date,end_date").eq("organization_id", organization_id).limit(200),
      admin.from("org_external_sources").select("id,kind,url,label,summary,last_status,last_synced_at").eq("organization_id", organization_id),
      admin.from("data_uploads_log")
        .select("id,file_name,detected_schema,status,file_path,ai_analysis,ai_analyzed_at,created_at")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false }),
    ]);

    const org = orgRes.data;
    const profile = profRes.data;
    const employees = empRes.data || [];
    const donations = donAggRes.data || [];
    const campaigns = campRes.data || [];
    const externalSources = externalRes.data || [];
    const uploadedDocuments = (uploadsRes.data || []) as UploadedDocument[];

    // 4) Compute donations summary (lightweight, deterministic)
    const totalAmount = donations.reduce(
      (s, d: any) => s + (Number(d.amount) || 0),
      0
    );
    const successfulCount = donations.filter((d: any) => d.status === "success").length;
    const projects = Array.from(
      new Set(donations.map((d: any) => d.project_name).filter(Boolean))
    ).slice(0, 30);
    const donationsSummary = {
      "إجمالي عدد التبرعات": donations.length,
      "إجمالي قيمة التبرعات": totalAmount,
      "عدد التبرعات الناجحة": successfulCount,
      "عدد المشاريع المختلفة": projects.length,
      "نماذج من المشاريع": projects.slice(0, 15),
      "عدد الحملات": campaigns.length,
    };

    // 5) Scrape sources in parallel
    const profileUrls: Record<string, string | undefined> = {
      website: profile?.website_url || undefined,
      store: profile?.store_url || undefined,
      twitter: profile?.twitter_url || undefined,
      instagram: profile?.instagram_url || undefined,
      youtube: profile?.youtube_url || undefined,
      tiktok: profile?.tiktok_url || undefined,
      snapchat: profile?.snapchat_url || undefined,
      facebook: profile?.facebook_url || undefined,
      linkedin: profile?.linkedin_url || undefined,
    };
    const sourcesByUrl = new Map<string, DigitalSource>();
    for (const [kind, rawUrl] of Object.entries(profileUrls)) {
      const url = validHttpUrl(rawUrl);
      if (url) sourcesByUrl.set(url, { kind, label: SOURCE_LABELS[kind] || "مصدر رقمي", url });
    }
    for (const source of externalSources) {
      const url = validHttpUrl(source.url);
      if (!url) continue;
      const current = sourcesByUrl.get(url);
      const cachedParts = [source.summary, source.last_status ? `حالة آخر مزامنة: ${source.last_status}` : null].filter(Boolean);
      sourcesByUrl.set(url, {
        id: source.id,
        kind: String(source.kind || current?.kind || "other"),
        label: String(source.label || current?.label || SOURCE_LABELS[source.kind] || "مصدر رقمي"),
        url,
        cachedContent: cachedParts.length ? cachedParts.join("\n") : current?.cachedContent,
      });
    }
    const digitalSources = Array.from(sourcesByUrl.values()).slice(0, 24);
    const sourceSnapshots = await Promise.all(digitalSources.map(firecrawlScrape));

    const documentSnapshots = uploadedDocuments.map((document) => ({
      upload_id: document.id,
      file_name: document.file_name,
      document_type: DOCUMENT_LABELS[document.detected_schema || ""] || "ملف مرفوع",
      upload_status: document.status || "غير محدد",
      analysis_status: document.ai_analysis
        ? "تم التحليل"
        : document.file_path
          ? "تعذر تحليل المحتوى"
          : "لا توجد نسخة محفوظة للتحليل",
      uploaded_at: document.created_at,
      analysis: compactDocumentAnalysis(document.ai_analysis),
    }));

    // 6) Call the AI for the deep analysis (single call returning a structured JSON)
    const systemPrompt = `أنت محلل استراتيجي خبير في الجمعيات الخيرية السعودية. ستحلل جمعية بشكل عميق ومتكامل بناءً على:
1) ملخص ملف التبرعات
2) محتوى الموقع الإلكتروني
3) محتوى المتجر الإلكتروني وتجربة التبرع ووضوح المشاريع والثقة ووسائل الدفع
4) جميع حسابات التواصل الاجتماعي والمصادر الرقمية المسجلة للجمعية، مصدراً مصدراً
5) جميع الملفات المرفوعة للجمعية، بما فيها اللوائح والسياسات ومحاضر الاجتماعات والخطط والتقارير وملفات البيانات، ملفاً ملفاً

مهمتك إخراج JSON بالشكل التالي بالضبط، مع كتابة جميع القيم النصية الظاهرة للقارئ بالعربية الفصحى الاحترافية حصراً:
{
  "overall_assessment": "تقييم عام شامل ومهني (3-5 أسطر)",
  "donors_segmentation": { "top_donors": [], "active": [], "lapsed": [], "summary": "..." },
  "campaigns_analysis": { "completed": [], "active": [], "gaps": "...", "summary": "..." },
  "website_insights": { "summary": "...", "what_offers": "...", "user_experience": "...", "donation_journey": "...", "transparency": "...", "published_reports": [], "strengths": [], "gaps": [], "recommendations": [] },
  "store_insights": { "summary": "...", "active_campaigns": [], "products_quality": "...", "donation_experience": "...", "trust_signals": "...", "strengths": [], "gaps": [], "recommendations": [] },
  "social_insights": { "summary": "خلاصة موحّدة مختصرة (سطران) لجميع الحسابات والمصادر الرقمية", "strengths": ["نقطتان كحد أقصى"], "gaps": ["فجوتان كحد أقصى"], "recommendations": ["ثلاث توصيات كحد أقصى"] },
  "document_insights": { "summary": "خلاصة موحّدة مختصرة (سطران) لما تكشفه جميع الملفات مجتمعة", "common_findings": ["ثلاث نتائج كحد أقصى"], "conflicts_and_gaps": ["ثلاث نقاط كحد أقصى"], "recommendations": ["ثلاث توصيات كحد أقصى"] },
  "strengths": ["نقطة قوة 1", "نقطة قوة 2", "..."],
  "gaps": ["فجوة 1 محددة", "فجوة 2 محددة", "..."],
  "recommendations": ["توصية تنفيذية 1", "توصية تنفيذية 2", "..."],
  "accountability_questions": [
    {
      "target_job_role": "اسم الدور الوظيفي بالعربي كما هو مسجل",
      "category": "campaigns | donors | reports | website | store | social | communications",
      "title": "عنوان موجز",
      "question_text": "سؤال محدد ودقيق للموظف يطلب منه إثبات أو إجابة (نعم/لا) مع تفصيل",
      "context": "لماذا تم طرح هذا السؤال (السياق من التحليل)",
      "expected_evidence": "نوع الإثبات المتوقع - رابط تقرير، صور، روابط منشورات",
      "priority": "low | medium | high | critical"
    }
  ]
}

قواعد إنتاج المساءلات:
- يجب أن تكون جميع النصوص والقيم والمصطلحات والأسماء الوصفية في النتيجة باللغة العربية فقط، دون أي كلمة أو اختصار أو حرف لاتيني.
- عرّب أسماء الحالات والقنوات والمفاهيم؛ مثلاً: نشط، مكتمل، الموقع الإلكتروني، المتجر الإلكتروني، التواصل الاجتماعي، مؤشر الأداء، والدعوة إلى الإجراء.
- مفاتيح بنية JSON الإنجليزية الموضحة أعلاه داخلية وغير ظاهرة، ويجب إبقاؤها كما هي حتى يعمل النظام.
- أنشئ بين 8 و 20 مساءلة موزعة على الأدوار الوظيفية الفعلية في قائمة الموظفين.
- إن لم يوجد موظف بدور معين فاجعل target_job_role = "قيادة" أو "مدير".
- كل مساءلة يجب أن تكون مرتبطة بفجوة أو نقطة من التحليل (ليست عامة).
- استخدم محتوى digital_sources و uploaded_documents كمدخلات خلفية فقط. لا تنشئ مراجعة منفصلة لكل مصدر ولا لكل ملف، ولا تذكر أسماء الملفات أو أسماء الحسابات أو روابطها في النتيجة.
- اجعل social_insights و document_insights خلاصة موحّدة مختصرة ومفيدة لكل المصادر ولكل الملفات مجتمعة، لا قوائم تفصيلية.
- قيّم الموقع والمتجر باختصار من حيث وضوح الرسالة، رحلة المتبرع، الثقة والشفافية، واكتمال المعلومات، مع ذكر أهم الفجوات فقط.
- التزم بالإيجاز: لا تتجاوز 5 عناصر في أي قائمة، وركّز على ما يقود إلى إجراء.
- حدد أنواع الإثبات بدقة (مثلاً: "روابط منشورات شكر للمتبرعين الكبار خلال آخر 90 يوم").`;

    const aiPayload = {
      organization: { name: org?.name, slug: org?.slug },
      profile: profile
        ? {
            about: profile.about,
            goals: profile.goals,
            website_url: profile.website_url,
            store_url: profile.store_url,
            social: {
              twitter: profile.twitter_url,
              instagram: profile.instagram_url,
              tiktok: profile.tiktok_url,
              snapchat: profile.snapchat_url,
              youtube: profile.youtube_url,
              facebook: profile.facebook_url,
            },
          }
        : null,
      employees_roles: employees.map((e: any) => ({
        job_role: e.job_role,
        role_level: e.role_level,
      })),
      donations_summary: donationsSummary,
      campaigns: campaigns.slice(0, 50),
      digital_sources: sourceSnapshots.map((source) => ({
        source_name: source.label,
        source_type: SOURCE_LABELS[source.kind] || source.kind,
        url: source.url,
        analysis_status: source.status,
        content: source.content,
      })),
      uploaded_documents: documentSnapshots
        .filter((document) => document.analysis)
        .slice(0, 24),
      uploaded_documents_coverage: {
        total: documentSnapshots.length,
        analyzed: documentSnapshots.filter((document) => document.analysis).length,
        unavailable: documentSnapshots.filter((document) => !document.analysis).length,
      },
    };

    const aiResult: any = await callAI(systemPrompt, aiPayload);
    const generatedDocumentInsights = aiResult.document_insights && typeof aiResult.document_insights === "object"
      ? aiResult.document_insights as Record<string, unknown>
      : {};

    // 7) Persist accountability_questions linked to employees by role when possible
    const questions: any[] = Array.isArray(aiResult.accountability_questions)
      ? aiResult.accountability_questions
      : [];

    const empByRole = new Map<string, any[]>();
    for (const e of employees) {
      const k = (e.job_role || "").trim();
      if (!k) continue;
      const arr = empByRole.get(k) || [];
      arr.push(e);
      empByRole.set(k, arr);
    }

    const inserts = questions.map((q) => {
      const role = (q.target_job_role || "").trim();
      const matches = empByRole.get(role) || [];
      // distribute round-robin: pick the employee with fewest letters (stable) or first
      const target = matches[0] || null;
      return {
        organization_id,
        deep_analysis_id: analysisRow.id,
        target_employee_id: target?.id ?? null,
        target_job_role: role || "قيادة",
        category: q.category || "general",
        title: q.title || "مساءلة",
        question_text: q.question_text || "",
        context: q.context || null,
        expected_evidence: q.expected_evidence || null,
        priority: ["low", "medium", "high", "critical"].includes(q.priority)
          ? q.priority
          : "medium",
        status: "open",
      };
    });

    let questionsInserted = 0;
    if (inserts.length > 0) {
      const { error: qErr, count } = await admin
        .from("accountability_questions")
        .insert(inserts, { count: "exact" });
      if (!qErr) questionsInserted = count || inserts.length;
    }

    // 8) Update analysis row to completed
    await admin
      .from("deep_analyses")
      .update({
        status: "completed",
        sources: sourceSnapshots.map(({ kind, label, url, status }) => ({ kind, label, url, status })),
        donations_summary: donationsSummary,
        donors_segmentation: aiResult.donors_segmentation || null,
        campaigns_analysis: aiResult.campaigns_analysis || null,
        website_insights: aiResult.website_insights || null,
        store_insights: aiResult.store_insights || null,
        social_insights: aiResult.social_insights || null,
        document_insights: {
          ...generatedDocumentInsights,
          summary: generatedDocumentInsights.summary || (uploadedDocuments.length
            ? "تم حصر الملفات المرفوعة، ولم تتوفر نتائج نصية كافية لإعداد تحليل تفصيلي لبعضها."
            : "لا توجد ملفات مرفوعة ضمن هذه الجمعية حتى الآن."),
          common_findings: Array.isArray(generatedDocumentInsights.common_findings) ? generatedDocumentInsights.common_findings : [],
          conflicts_and_gaps: Array.isArray(generatedDocumentInsights.conflicts_and_gaps) ? generatedDocumentInsights.conflicts_and_gaps : [],
          recommendations: Array.isArray(generatedDocumentInsights.recommendations) ? generatedDocumentInsights.recommendations : [],
          file_reviews: completeFileReviews,
        },
        overall_assessment: aiResult.overall_assessment || null,
        strengths: aiResult.strengths || null,
        gaps: aiResult.gaps || null,
        recommendations: aiResult.recommendations || null,
        questions_generated: questionsInserted,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisRow.id);

    console.log("analysis completed", analysisRow.id, "questions:", questionsInserted);
  } catch (e: any) {
    await admin
      .from("deep_analyses")
      .update({
        status: "failed",
        error_message: String(e?.message || e),
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisRow.id);
    console.error("analysis failed", analysisRow.id, String(e?.message || e));
  }
  };

  const work = runAnalysis();
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else work.catch(() => {});

  return new Response(
    JSON.stringify({ started: true, analysis_id: analysisRow.id, status: "running" }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});