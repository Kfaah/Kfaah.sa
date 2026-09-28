import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { authorizationErrorResponse, requireOrganizationAccess } from "../_shared/authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Alert = {
  id: string;
  severity: "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  recommendation: string;
  metric?: string | number;
  cta?: { label: string; action: string; payload?: any };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await requireOrganizationAccess(req, organization_id, supabase);

    const alerts: Alert[] = [];
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    // 1. Lapsed donors (no donation in 90 days but had donations before)
    const { data: lapsed } = await supabase
      .from("donations")
      .select("donor_id, donation_date, amount")
      .eq("organization_id", organization_id)
      .eq("status", "success")
      .order("donation_date", { ascending: false })
      .limit(1000);

    if (lapsed && lapsed.length > 0) {
      const lastByDonor = new Map<string, { date: string; amount: number }>();
      lapsed.forEach((d: any) => {
        if (!d.donor_id) return;
        if (!lastByDonor.has(d.donor_id)) {
          lastByDonor.set(d.donor_id, { date: d.donation_date, amount: Number(d.amount || 0) });
        }
      });
      const lapsedCount = Array.from(lastByDonor.values()).filter(
        (x) => x.date && x.date < ninetyDaysAgo
      ).length;
      if (lapsedCount >= 5) {
        alerts.push({
          id: "lapsed_donors",
          severity: lapsedCount > 30 ? "high" : "medium",
          type: "donor_recovery",
          title: `${lapsedCount} متبرع منقطع منذ ٩٠ يوم`,
          description: "هؤلاء متبرعون سابقون لم يتبرعوا منذ فترة. فرصة استرجاع قوية.",
          recommendation: "أطلق حملة استرجاع برسالة شخصية ومشروع محدد + تذكير بأثر تبرعهم السابق.",
          metric: lapsedCount,
          cta: { label: "أنشئ حملة استرجاع", action: "create_campaign", payload: { audience: "lapsed", goal: "استرجاع المتبرعين المنقطعين" } },
        });
      }
    }

    // 2. Recent week performance
    const { count: recentDonationsCount } = await supabase
      .from("donations")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .eq("status", "success")
      .gte("donation_date", sevenDaysAgo);

    if ((recentDonationsCount ?? 0) === 0) {
      alerts.push({
        id: "no_donations_week",
        severity: "high",
        type: "performance",
        title: "لا توجد تبرعات هذا الأسبوع",
        description: "مر أسبوع كامل دون أي تبرع ناجح مسجّل.",
        recommendation: "أطلق حملة سريعة عبر واتساب وSMS للمتبرعين المتكررين.",
        cta: { label: "حملة طوارئ", action: "create_campaign", payload: { audience: "recurring", goal: "تنشيط التبرعات الفورية" } },
      });
    }

    // 3. Upcoming seasonal events (next 60 days)
    const { data: events } = await supabase
      .from("marketing_seasonal_events")
      .select("*")
      .eq("is_active", true);

    const currentMonth = now.getMonth() + 1;
    const upcoming = (events ?? []).filter((e: any) => {
      if (e.gregorian_month) {
        const diff = (e.gregorian_month - currentMonth + 12) % 12;
        return diff <= 2;
      }
      return false;
    });
    upcoming.forEach((e: any) => {
      alerts.push({
        id: `season_${e.key}`,
        severity: "medium",
        type: "seasonal_opportunity",
        title: `${e.name_ar} يقترب`,
        description: e.description ?? "موسم تسويقي قادم — جهّز حملتك مبكرًا.",
        recommendation: Array.isArray(e.marketing_tips) && e.marketing_tips.length
          ? e.marketing_tips.slice(0, 2).join(" · ")
          : "ابدأ التخطيط قبل أسبوعين على الأقل لاستثمار الموسم بالكامل.",
        cta: { label: "حملة موسمية", action: "create_campaign", payload: { season_key: e.key, name: `حملة ${e.name_ar}` } },
      });
    });

    // 4. Top project (last 30 days)
    const { data: recentDonations } = await supabase
      .from("donations")
      .select("project_name, amount")
      .eq("organization_id", organization_id)
      .eq("status", "success")
      .gte("donation_date", thirtyDaysAgo)
      .limit(1000);

    const projectTotals = new Map<string, number>();
    (recentDonations ?? []).forEach((d: any) => {
      const p = d.project_name || "غير محدد";
      projectTotals.set(p, (projectTotals.get(p) ?? 0) + Number(d.amount || 0));
    });
    const sortedProjects = Array.from(projectTotals.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedProjects.length > 0 && sortedProjects[0][0] !== "غير محدد") {
      const [topName, topAmount] = sortedProjects[0];
      alerts.push({
        id: "top_project",
        severity: "low",
        type: "performance_insight",
        title: `مشروع "${topName}" يتصدر هذا الشهر`,
        description: `حقق ${topAmount.toLocaleString("ar-SA")} ر.س خلال آخر ٣٠ يوم.`,
        recommendation: "ضاعف التسويق له واستخرج قصة نجاح للمتبرعين الجدد.",
        metric: topAmount,
        cta: { label: "حملة على المشروع", action: "create_campaign", payload: { related_project: topName, goal: `تعظيم نتائج مشروع ${topName}` } },
      });
    }

    // 5. Stagnant active campaigns
    const { data: activeCampaigns } = await supabase
      .from("marketing_campaigns")
      .select("id, name, updated_at, status")
      .eq("organization_id", organization_id)
      .in("status", ["active", "planned"]);

    const stagnant = (activeCampaigns ?? []).filter((c: any) => c.updated_at < thirtyDaysAgo);
    if (stagnant.length > 0) {
      alerts.push({
        id: "stagnant_campaigns",
        severity: "medium",
        type: "campaign_health",
        title: `${stagnant.length} حملة لم تُحدّث منذ ٣٠ يومًا`,
        description: "حملات نشطة/مخططة بدون أي تحديث حديث — قد تحتاج لمراجعة أو إغلاق.",
        recommendation: "راجع نتائجها، أعد تنشيطها أو أرشفها لتحرير التركيز.",
        metric: stagnant.length,
      });
    }

    return new Response(JSON.stringify({ alerts, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const authError = authorizationErrorResponse(e, corsHeaders);
    if (authError) return authError;
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});