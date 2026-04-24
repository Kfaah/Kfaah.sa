// Deep Organization Analysis
// يدمج: ملف التبرعات + الموقع الإلكتروني + المتجر + حسابات التواصل
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

const AI_MODEL = "google/gemini-2.5-pro";

interface AnalyzeRequest {
  organization_id: string;
  upload_id?: string | null;
  trigger_source?: "manual" | "upload" | "scheduled";
}

async function firecrawlScrape(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || !url) return "";
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!r.ok) return "";
    const j = await r.json();
    const md =
      j?.markdown ||
      j?.data?.markdown ||
      j?.data?.content ||
      "";
    return typeof md === "string" ? md.slice(0, 8000) : "";
  } catch {
    return "";
  }
}

async function callAI(systemPrompt: string, userPayload: unknown) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`AI gateway error ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
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

  try {
    // 3) Load org + profile + employees + donations summary
    const [orgRes, profRes, empRes, donAggRes, campRes] = await Promise.all([
      admin.from("organizations").select("id,name,slug").eq("id", organization_id).maybeSingle(),
      admin.from("organization_profiles").select("*").eq("organization_id", organization_id).maybeSingle(),
      admin.from("employees").select("id,full_name,job_role,role_level").eq("organization_id", organization_id),
      admin.from("donations")
        .select("amount, donation_date, project_name, donor_id, status")
        .eq("organization_id", organization_id)
        .limit(2000),
      admin.from("campaigns").select("id,name,status,goal_amount,collected_amount,start_date,end_date").eq("organization_id", organization_id).limit(200),
    ]);

    const org = orgRes.data;
    const profile = profRes.data;
    const employees = empRes.data || [];
    const donations = donAggRes.data || [];
    const campaigns = campRes.data || [];

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
      total_donations_count: donations.length,
      total_amount: totalAmount,
      successful_count: successfulCount,
      distinct_projects: projects.length,
      sample_projects: projects.slice(0, 15),
      campaigns_count: campaigns.length,
    };

    // 5) Scrape sources in parallel
    const sourceUrls: Record<string, string | undefined> = {
      website: profile?.website_url || undefined,
      store: profile?.store_url || undefined,
      twitter: profile?.twitter_url || undefined,
      instagram: profile?.instagram_url || undefined,
      youtube: profile?.youtube_url || undefined,
    };

    const scrapedEntries: Record<string, string> = {};
    await Promise.all(
      Object.entries(sourceUrls).map(async ([k, u]) => {
        if (u) scrapedEntries[k] = await firecrawlScrape(u);
      })
    );

    // 6) Call the AI for the deep analysis (single call returning a structured JSON)
    const systemPrompt = `أنت محلل استراتيجي خبير في الجمعيات الخيرية السعودية. ستحلل جمعية بشكل عميق ومتكامل بناءً على:
1) ملخص ملف التبرعات
2) محتوى الموقع الإلكتروني
3) محتوى المتجر الإلكتروني
4) حسابات التواصل الاجتماعي

مهمتك إخراج JSON بالشكل التالي بالضبط (بالعربية الفصحى الاحترافية):
{
  "overall_assessment": "تقييم عام شامل ومهني (3-5 أسطر)",
  "donors_segmentation": { "top_donors": [], "active": [], "lapsed": [], "summary": "..." },
  "campaigns_analysis": { "completed": [], "active": [], "gaps": "...", "summary": "..." },
  "website_insights": { "what_offers": "...", "published_reports": [], "gaps": "..." },
  "store_insights": { "active_campaigns": [], "products_quality": "...", "gaps": "..." },
  "social_insights": { "activity_level": "...", "content_quality": "...", "gaps": "..." },
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
- أنشئ بين 8 و 20 مساءلة موزعة على الأدوار الوظيفية الفعلية في قائمة الموظفين.
- إن لم يوجد موظف بدور معين فاجعل target_job_role = "قيادة" أو "مدير".
- كل مساءلة يجب أن تكون مرتبطة بفجوة أو نقطة من التحليل (ليست عامة).
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
      scraped: {
        website: scrapedEntries.website?.slice(0, 4000) || null,
        store: scrapedEntries.store?.slice(0, 4000) || null,
        twitter: scrapedEntries.twitter?.slice(0, 1500) || null,
        instagram: scrapedEntries.instagram?.slice(0, 1500) || null,
        youtube: scrapedEntries.youtube?.slice(0, 1500) || null,
      },
    };

    const aiResult: any = await callAI(systemPrompt, aiPayload);

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
        sources: sourceUrls,
        donations_summary: donationsSummary,
        donors_segmentation: aiResult.donors_segmentation || null,
        campaigns_analysis: aiResult.campaigns_analysis || null,
        website_insights: aiResult.website_insights || null,
        store_insights: aiResult.store_insights || null,
        social_insights: aiResult.social_insights || null,
        overall_assessment: aiResult.overall_assessment || null,
        strengths: aiResult.strengths || null,
        gaps: aiResult.gaps || null,
        recommendations: aiResult.recommendations || null,
        questions_generated: questionsInserted,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisRow.id);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: analysisRow.id,
        questions_generated: questionsInserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    await admin
      .from("deep_analyses")
      .update({
        status: "failed",
        error_message: String(e?.message || e),
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisRow.id);
    return new Response(
      JSON.stringify({ error: "analysis_failed", details: String(e?.message || e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});