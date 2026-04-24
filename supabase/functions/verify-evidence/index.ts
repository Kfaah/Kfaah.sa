// Strict + comprehensive evidence verification engine.
// Flow: take an evidence URL → scrape (Firecrawl) → ask Gemini to judge it
// strictly against the question + expected_evidence → store findings in
// evidence_checks → update accountability_questions → if verdict is
// insufficient/missing, generate an accountability_task automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface VerifyBody {
  question_id: string;
  evidence_url: string;
  evidence_notes?: string;
  answer_yes_no?: "yes" | "no";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = (await req.json()) as VerifyBody;
    if (!body?.question_id || !body?.evidence_url) {
      return jsonResp({ error: "question_id و evidence_url مطلوبان" }, 400);
    }

    // 1) Verify caller can see this question (RLS)
    const { data: q, error: qErr } = await userClient
      .from("accountability_questions")
      .select("id,title,question_text,expected_evidence,context,priority,category,target_employee_id,target_job_role,organization_id,deep_analysis_id")
      .eq("id", body.question_id)
      .maybeSingle();
    if (qErr || !q) return jsonResp({ error: "السؤال غير متاح" }, 403);

    // 2) Insert pending evidence_check (admin client to bypass employee RLS for write)
    const { data: chk, error: chkErr } = await admin
      .from("evidence_checks")
      .insert({
        accountability_question_id: q.id,
        organization_id: q.organization_id,
        evidence_url: body.evidence_url,
        scrape_status: "pending",
        strict_mode: true,
      })
      .select()
      .single();
    if (chkErr) throw new Error(`failed to create evidence_check: ${chkErr.message}`);

    // 3) Scrape the evidence URL with Firecrawl
    let scrapedMarkdown = "";
    let scrapeMeta: Record<string, unknown> = {};
    let scrapeStatus = "success";
    let scrapeErr: string | null = null;
    try {
      const fcRes = await fetch(`${FIRECRAWL_V2}/scrape`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: body.evidence_url,
          formats: ["markdown", "links"],
          onlyMainContent: false,
          waitFor: 1500,
        }),
      });
      const fcJson = await fcRes.json();
      if (!fcRes.ok) throw new Error(fcJson?.error || `firecrawl ${fcRes.status}`);
      scrapedMarkdown = (fcJson.markdown ?? fcJson.data?.markdown ?? "").toString();
      scrapeMeta = fcJson.metadata ?? fcJson.data?.metadata ?? {};
    } catch (e) {
      scrapeStatus = "failed";
      scrapeErr = e instanceof Error ? e.message : "scrape failed";
    }

    // 4) Ask Gemini for a strict judgment via tool calling (structured output)
    const judgement = await callJudgeAI({
      apiKey: LOVABLE_API_KEY,
      question: q,
      evidenceUrl: body.evidence_url,
      evidenceNotes: body.evidence_notes ?? "",
      answerYesNo: body.answer_yes_no ?? null,
      scrapedMarkdown: scrapedMarkdown.slice(0, 60000),
      scrapeStatus,
      scrapeError: scrapeErr,
    });

    const verdict = judgement.verdict; // accepted | partial | insufficient | rejected
    const score = Number(judgement.overall_score ?? 0);
    const findings = judgement.findings ?? [];
    const subChecks = judgement.sub_checks ?? [];
    const missing = judgement.missing_items ?? [];
    const recommendations = judgement.recommendations ?? "";

    // 5) Update evidence_check with results
    await admin
      .from("evidence_checks")
      .update({
        scrape_status: scrapeStatus,
        scrape_content_excerpt: scrapedMarkdown.slice(0, 4000),
        scrape_metadata: scrapeMeta,
        error_message: scrapeErr,
        ai_model: "google/gemini-2.5-pro",
        score,
        verdict,
        findings,
        sub_checks: subChecks,
        missing_items: missing,
        recommendations,
      })
      .eq("id", chk.id);

    // 6) Update the question itself
    const newStatus =
      verdict === "accepted" ? "validated" :
      verdict === "partial" ? "answered" :
      verdict === "insufficient" ? "answered" :
      "rejected";

    await admin
      .from("accountability_questions")
      .update({
        status: newStatus,
        answer_yes_no: body.answer_yes_no ?? null,
        evidence_url: body.evidence_url,
        evidence_notes: body.evidence_notes ?? null,
        evidence_check_id: chk.id,
        evidence_findings: findings,
        evidence_score: score,
        evidence_verdict: verdict,
        last_check_score: score,
        last_check_verdict: verdict,
        answered_at: new Date().toISOString(),
      })
      .eq("id", q.id);

    // 7) If verdict is not accepted → generate a follow-up accountability task
    let generatedTaskId: string | null = null;
    if (verdict !== "accepted") {
      const taskTitle =
        verdict === "rejected"
          ? `إعادة تقديم إثبات: ${q.title}`
          : `استكمال إثبات ناقص: ${q.title}`;

      const taskDescription = [
        `السؤال: ${q.question_text}`,
        ``,
        `حكم النظام: ${verdictLabel(verdict)} (الدرجة: ${score}/100)`,
        ``,
        `العناصر المطلوب استكمالها:`,
        ...(missing.length > 0
          ? missing.map((m: string, i: number) => `${i + 1}. ${m}`)
          : ["مراجعة الإثباتات المرفوعة وإعادة تقديمها بصيغة كاملة"]),
        ``,
        `توصيات الفحص: ${recommendations || "—"}`,
      ].join("\n");

      const { data: t } = await admin
        .from("accountability_tasks")
        .insert({
          organization_id: q.organization_id,
          title: taskTitle,
          description: taskDescription,
          detailed_instructions: recommendations,
          target_job_role: q.target_job_role,
          assigned_employee_id: q.target_employee_id,
          source: "evidence_gap",
          source_id: chk.id,
          parent_question_id: q.id,
          gap_reason: `verdict=${verdict}, score=${score}`,
          evidence_score_when_generated: score,
          status: "pending",
          priority: q.priority === "critical" ? "critical" : q.priority === "high" ? "high" : "medium",
          category: q.category,
          ai_generated: true,
          ai_reason: `تم توليد المهمة تلقائيًا بناءً على فحص الإثبات (${verdict}).`,
          due_date: addDaysISO(verdict === "rejected" ? 2 : 4),
        })
        .select("id")
        .single();
      generatedTaskId = t?.id ?? null;

      if (generatedTaskId) {
        await admin
          .from("accountability_questions")
          .update({ generated_task_id: generatedTaskId })
          .eq("id", q.id);
      }
    }

    return jsonResp({
      success: true,
      verdict,
      score,
      findings,
      sub_checks: subChecks,
      missing_items: missing,
      recommendations,
      check_id: chk.id,
      generated_task_id: generatedTaskId,
    });
  } catch (e) {
    console.error("verify-evidence error:", e);
    return jsonResp({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function verdictLabel(v: string) {
  return (
    {
      accepted: "مقبول كامل",
      partial: "مقبول جزئيًا",
      insufficient: "ناقص",
      rejected: "مرفوض",
    } as Record<string, string>
  )[v] ?? v;
}

async function callJudgeAI(params: {
  apiKey: string;
  question: any;
  evidenceUrl: string;
  evidenceNotes: string;
  answerYesNo: "yes" | "no" | null;
  scrapedMarkdown: string;
  scrapeStatus: string;
  scrapeError: string | null;
}) {
  const { apiKey, question: q } = params;

  const systemPrompt = `أنت مدقّق احترافي صارم لإثباتات المساءلة في جمعية خيرية.
مهمتك: تقييم رابط الإثبات الذي قدّمه الموظف بشكل دقيق وشامل، والإجابة عن:
1) هل الرابط فُتح فعلاً ويعمل؟
2) هل المحتوى يُطابق ما طلبته المساءلة بدقة؟
3) هل التفاصيل المتوقعة (أسماء، أرقام، تواريخ، مستفيدون، تقارير) فعلاً موجودة وكافية؟
4) ما العناصر الناقصة؟

أصدر حكمًا من أربع درجات: accepted | partial | insufficient | rejected
- accepted: كل العناصر المطلوبة موجودة وموثّقة بدقة (≥90)
- partial: غالب العناصر موجود لكن هناك نواقص بسيطة (60-89)
- insufficient: نواقص كبيرة أو محتوى عام بدون أدلة محددة (30-59)
- rejected: الرابط لا يعمل، أو لا علاقة له، أو فارغ، أو محتوى غير ذي صلة (<30)

كن صارمًا. الموظف يستحق توجيهًا واضحًا وليس مجاملة.`;

  const userPrompt = `معلومات المساءلة:
- العنوان: ${q.title}
- نص السؤال: ${q.question_text}
- الفئة: ${q.category}
- الأولوية: ${q.priority}
- الإثبات المتوقع: ${q.expected_evidence ?? "—"}
- السياق: ${q.context ?? "—"}
- الدور الوظيفي المسؤول: ${q.target_job_role}

إجابة الموظف:
- نعم/لا: ${params.answerYesNo ?? "(لم يُحدد)"}
- ملاحظاته: ${params.evidenceNotes || "—"}
- رابط الإثبات: ${params.evidenceUrl}

حالة الزحف للرابط: ${params.scrapeStatus}${params.scrapeError ? ` (خطأ: ${params.scrapeError})` : ""}

محتوى الرابط المُستخرَج (markdown):
"""
${params.scrapedMarkdown || "(لا محتوى — قد يكون الرابط لا يعمل أو يتطلب تسجيل دخول)"}
"""

الآن قيّم الإثبات بشكل صارم وشامل، وأرجع النتيجة عبر الأداة المحددة.`;

  const tool = {
    type: "function",
    function: {
      name: "submit_evidence_judgement",
      description: "Return a strict, structured judgement on the submitted evidence.",
      parameters: {
        type: "object",
        properties: {
          verdict: {
            type: "string",
            enum: ["accepted", "partial", "insufficient", "rejected"],
          },
          overall_score: { type: "number", minimum: 0, maximum: 100 },
          summary: { type: "string" },
          findings: {
            type: "array",
            items: { type: "string" },
            description: "ملاحظات تفصيلية عمّا وُجد في الرابط",
          },
          sub_checks: {
            type: "array",
            description: "فحوصات فرعية مفصّلة",
            items: {
              type: "object",
              properties: {
                criterion: { type: "string" },
                passed: { type: "boolean" },
                evidence: { type: "string" },
              },
              required: ["criterion", "passed", "evidence"],
            },
          },
          missing_items: {
            type: "array",
            items: { type: "string" },
            description: "العناصر الناقصة من الإثبات",
          },
          recommendations: {
            type: "string",
            description: "توصيات للموظف لاستكمال الإثبات",
          },
        },
        required: ["verdict", "overall_score", "summary", "findings", "sub_checks", "missing_items", "recommendations"],
      },
    },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "submit_evidence_judgement" } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI judge error ${res.status}: ${t}`);
  }
  const json = await res.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI returned no tool call");
  return JSON.parse(call.function.arguments);
}