import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, conversationId } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // استخدام بوابة الذكاء المدمجة لضمان الاتصال بدون مفاتيح خارجية.
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: any) => m?.role === "user")?.content ?? "";
    const text = String(lastUserMsg);

    // استخدم Haiku للرسائل القصيرة جداً (تحية/سؤال بسيط) لتوفير التكلفة
    const isShortChat = text.length < 60;
    const selectedModel = isShortChat
      ? "google/gemini-2.5-flash-lite"
      : "google/gemini-2.5-flash";
    const routedReason = isShortChat ? "short_chat" : "default_sonnet";

    // Pull a small employee context for the system prompt
    const { data: emp } = await supabase
      .from("employees")
      .select("full_name, job_role, organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Load deep platform context so the assistant answers based on the user's
    // actual data and the platform's specific vocabulary — not generic answers.
    const orgId = emp?.organization_id ?? null;
    let orgContext = "";
    if (orgId) {
      const [orgRes, tiersRes, donorsStatRes, donationsAggRes, projectsRes, plansRes, tasksRes, campaignsRes] = await Promise.all([
        supabase.from("organizations").select("name, slug, subscription_tier").eq("id", orgId).maybeSingle(),
        supabase.from("org_donor_tiers").select("*").eq("organization_id", orgId).maybeSingle(),
        supabase.from("donors").select("id, segment, total_donated", { count: "exact" }).eq("organization_id", orgId).limit(1000),
        supabase.from("donations").select("amount, status").eq("organization_id", orgId).limit(2000),
        supabase.from("projects_catalog").select("name, is_active").eq("organization_id", orgId).limit(50),
        supabase.from("operational_plans").select("plan_name, year, status").eq("organization_id", orgId).limit(30),
        supabase.from("tasks").select("title, status, priority, due_date").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(15),
        supabase.from("marketing_campaigns").select("name, status, start_date").eq("organization_id", orgId).limit(20),
      ]);

      const donors = (donorsStatRes.data ?? []) as any[];
      const segCounts: Record<string, number> = {};
      for (const d of donors) {
        const s = d.segment || "غير مصنف";
        segCounts[s] = (segCounts[s] ?? 0) + 1;
      }
      const donations = (donationsAggRes.data ?? []) as any[];
      const totalDonations = donations.reduce((a, d) => a + (Number(d.amount) || 0), 0);
      const successful = donations.filter((d) => d.status === "successful" || d.status === "ناجح").length;

      orgContext = `
## بيانات الجمعية (سياق حقيقي للإجابة عليه)
- اسم الجمعية: ${orgRes.data?.name ?? "—"} (slug: ${orgRes.data?.slug ?? "—"})
- عدد المتبرعين: ${donors.length}، الشرائح: ${JSON.stringify(segCounts)}
- إجمالي التبرعات (آخر 2000 عملية): ${totalDonations.toLocaleString("ar-SA")} ر.س، الناجحة: ${successful}
- المشاريع النشطة: ${(projectsRes.data ?? []).filter((p: any) => p.is_active).map((p: any) => p.name).join("، ") || "—"}
- الخطط التشغيلية: ${(plansRes.data ?? []).map((p: any) => `${p.plan_name} (${p.year}/${p.status})`).join("، ") || "—"}
- الحملات التسويقية: ${(campaignsRes.data ?? []).map((c: any) => `${c.name} (${c.status})`).join("، ") || "—"}
- مهام الموظف الأخيرة: ${(tasksRes.data ?? []).map((t: any) => `«${t.title}» [${t.status}${t.priority ? "/" + t.priority : ""}]`).join("، ") || "لا توجد"}

## فئات المتبرعين في هذه الجمعية (org_donor_tiers)
- الفئة A (≥ ${tiersRes.data?.tier_a_min ?? 5000} ر.س): قناة التواصل: ${tiersRes.data?.tier_a_channel ?? "خطاب رسمي + اتصال"}
- الفئة B (≥ ${tiersRes.data?.tier_b_min ?? 2000} ر.س): ${tiersRes.data?.tier_b_channel ?? "اتصال هاتفي"}
- الفئة C (≥ ${tiersRes.data?.tier_c_min ?? 500} ر.س): ${tiersRes.data?.tier_c_channel ?? "رسالة واتساب شخصية"}
- الفئة D (أقل): ${tiersRes.data?.tier_d_channel ?? "رسالة SMS"}`;
    }

    const platformGlossary = `
## قاموس مصطلحات المنصة (استخدمه حرفيًا في الإجابة)
- **النخبة (في مركز التبرعات / DonorsHub):** المتبرعون الذين لديهم نشاطان أو أكثر مجتمعين (تبرعات + استقطاعات + حملات + إهداءات + سلال متروكة). يُصنّفون داخل النخبة إلى:
  • **ماسي**: 5 أنشطة كاملة.
  • **ذهبي**: 4 أنشطة فأكثر.
  • **فضي**: 3 أنشطة فأكثر.
  • **برونزي**: نشاطان فأكثر.
- **الفئات A/B/C/D:** تصنيف مالي مختلف عن النخبة، يعتمد على حد أدنى لمبلغ التبرع الكلي (يُضبط في org_donor_tiers)، ولكل فئة قناة تواصل مفضّلة.
- **السلال المتروكة (abandoned_carts):** تبرعات بدأها المتبرع ولم يُكملها — فرصة استرداد.
- **الإهداءات (gifts):** تبرعات نيابة عن شخص آخر.
- **الاستقطاعات (subscriptions):** تبرع شهري متكرر.
- **الخطط التشغيلية:** أنشطة سنوية مرتبطة بالأهداف الاستراتيجية والمبادرات.
- **مساحة الحملة (Campaign Workspace):** صفحة الحملة التسويقية الواحدة بكامل تفاصيلها.
- **المهام الذكية (smart-task-dispatcher):** توليد مهام تلقائي للموظفين من الخطط والحملات.
- **الرؤى الذكية (Intelligence):** تحليلات AI على بيانات الجمعية.
- **التقييم العام في المساعد:** متوسط (إنجاز المهام + جودة AI + كفاءة الوقت + استخدام AI).`;

    const systemPrompt = `أنت "المساعد الذكي" داخل منصة كفاءة لإدارة الجمعيات الخيرية. أنت لست مساعدًا عامًا — أنت خبير في هذه المنصة تحديدًا، وتجيب بناءً على بيانات الجمعية الحقيقية أدناه ومصطلحات المنصة الواردة في القاموس.

اسم الموظف: ${emp?.full_name ?? "غير محدد"}
الوظيفة: ${emp?.job_role ?? "غير محددة"}
${orgContext}
${platformGlossary}

## قواعد الإجابة الصارمة
1. إذا سألك الموظف عن مصطلح في المنصة (مثل: ما المقصود بالنخبة؟ ما هي الفئة A؟ ما السلال المتروكة؟) — أجب من القاموس أعلاه حصرًا، لا من معرفتك العامة.
2. إذا سألك عن أرقام جمعيته أو متبرعيه أو مهامه — استخدم البيانات الفعلية أعلاه.
3. اربط الإجابة دائمًا بسياق المنصة (اذكر اسم الجمعية، الشريحة، المشروع، الخطة المعنية).
4. إذا لم تجد المعلومة في السياق، قل صراحة: "هذه المعلومة غير متوفرة في بياناتك حاليًا" — ولا تخترع.
5. اكتب بالعربية الفصحى المبسطة، بتنسيق Markdown، مختصرًا ومباشرًا.`;

    // Log this conversation as AI usage (best-effort)
    try {
      await supabase.from("employee_ai_usage_logs").insert({
        user_id: user.id,
        organization_id: emp?.organization_id ?? null,
        feature: "assistant_chat",
        context: {
          conversation_id: conversationId ?? null,
          model: selectedModel,
          routed_reason: routedReason,
        },
      });
    } catch (_) { /* ignore */ }

    const chatMessages = messages
      .filter((m: any) => m?.role === "user" || m?.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
      }));

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الاستخدام، حاول بعد دقيقة." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402 || aiResp.status === 403) {
        return new Response(
          JSON.stringify({ error: "نفذ رصيد الذكاء الاصطناعي." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});