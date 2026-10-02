import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DateRange = { from: Date | null; to: Date | null; label: string };

export interface OrgMetrics {
  org_id: string;
  org_name: string;
  org_slug: string | null;
  is_active: boolean;
  members: number;
  donors: number;             // active donors in period (or all-time when no filter)
  donors_total: number;       // all-time donors count for the org
  donations_count: number;
  total_donated: number;
  avg_donation: number;
  recurring_donors: number;
  abandoned_carts: number;
  recovered_carts: number;
  recovery_rate: number;
  failed_donations: number;
  bank_transfers: number;
  matched_transfers: number;
  campaigns: number;
  marketing_ideas: number;
  insights: number;
  tasks_total: number;
  tasks_completed: number;
  task_completion_rate: number;
  employees_count: number;
  // ===== gifts (الإهداءات) =====
  gifts_count: number;
  gifts_amount: number;
  gifts_delivered: number;
  gifts_delivery_rate: number;
  unique_gift_givers: number;
  // ===== donor service =====
  failure_rate: number;       // failed_donations / (donations_count + failed_donations) * 100
  match_rate: number;         // matched_transfers / bank_transfers * 100
  // ===== store health =====
  store_health_score: number; // composite of recovery + match + low-failure
  // ===== projects/campaigns =====
  projects_count: number;       // distinct project_name in donations
  top_project_name: string | null;
  top_project_amount: number;
  top_project_share: number;    // % of total donations
  // contextual
  expected_target: number;    // active_donors × 10 × months_in_period
  period_months: number;
  // Monthly donor efficiency (previous full calendar month, NOT affected by filter)
  prev_month_donations: number;     // SAR collected last full month
  prev_month_label: string;         // e.g. "2025-03"
  donor_efficiency: number;         // prev_month_donations / donors_total (SAR per donor)
  donor_efficiency_score: number;   // 0..100, benchmark = 10 SAR/donor/month
  // composite scores (0..100)
  fundraising_score: number;
  donor_engagement_score: number;
  service_score: number;
  team_score: number;
  overall_score: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function monthsBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.max(ms / (1000 * 60 * 60 * 24 * 30.4375), 1 / 30); // min 1 day
}

export function useAdminAggregates(range?: DateRange) {
  const [metrics, setMetrics] = useState<OrgMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fromIso = range?.from ? range.from.toISOString() : null;
  const toIso = range?.to ? range.to.toISOString() : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null); setMetrics([]);
      const { data: orgs, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, is_active")
        .order("created_at", { ascending: true });

      if (orgError) throw orgError;
      if (!orgs) { if (!cancelled) { setMetrics([]); setLoading(false); } return; }

      const results = await Promise.all(orgs.map(async (o) => {
        const orgId = o.id;
        const nowForMonth = new Date();
        const previousStart = new Date(nowForMonth.getFullYear(), nowForMonth.getMonth() - 1, 1);
        const previousEnd = new Date(nowForMonth.getFullYear(), nowForMonth.getMonth(), 1);
        const prevMonthLabel = `${previousStart.getFullYear()}-${String(previousStart.getMonth() + 1).padStart(2, "0")}`;
        const { data, error } = await supabase.rpc("org_reporting_summary", {
          p_org: orgId, p_from: fromIso, p_to: toIso,
          p_prev_from: previousStart.toISOString(), p_prev_to: previousEnd.toISOString(),
        });
        if (error || !data) throw error || new Error("Reporting aggregate missing");
        const summary = data as unknown as Record<string, number | string | null>;
        const n = (key: string) => Number(summary[key] ?? 0);
        const donations_count = n("donations_count"), total_donated = n("total_donated");
        const donors_total = n("donors_total");
        const donors = n("active_donors") || (fromIso || toIso ? 0 : donors_total);
        const recurring = n("recurring_donors"), abandoned = n("abandoned_carts"), recovered = n("recovered_carts");
        const transfers = n("bank_transfers"), matched = n("matched_transfers"), failed = n("failed_donations");
        const tasksTotal = n("tasks_total"), tasksDone = n("tasks_completed");
        const gifts_count = n("gifts_count"), gifts_amount = n("gifts_amount"), gifts_delivered = n("gifts_delivered");
        const gifts_delivery_rate = gifts_count ? gifts_delivered / gifts_count * 100 : 0;
        const unique_gift_givers = n("unique_gift_givers"), projects_count = n("projects_count");
        const top_project_name = summary.top_project_name as string | null;
        const top_project_amount = n("top_project_amount");
        const top_project_share = total_donated ? top_project_amount / total_donated * 100 : 0;
        const prev_month_donations = n("prev_month_donations");

        const avg_donation = donations_count ? total_donated / donations_count : 0;
        const recovery_rate = abandoned ? (recovered / abandoned) * 100 : 0;
        const match_rate = transfers ? (matched / transfers) * 100 : 0;
        const completion = tasksTotal ? (tasksDone / tasksTotal) * 100 : 0;
        const recurring_pct = donors_total ? (recurring / donors_total) * 100 : 0;
        const totalAttempts = donations_count + failed;
        const failure_rate = totalAttempts ? (failed / totalAttempts) * 100 : 0;
        // Store health = weighted: low failure + high recovery + high match
        const store_health_score = clamp(
          (100 - failure_rate) * 0.4 + recovery_rate * 0.3 + match_rate * 0.3
        );

        // Period in months
        const now = new Date();
        const fromD = range?.from || new Date(2000, 0, 1);
        const toD = range?.to || now;
        const period_months = monthsBetween(fromD, toD);

        // === Fundraising score ===
        // Computed AFTER all orgs are aggregated as relative percentage
        // of the top-collecting org. Placeholder here = 0.
        const benchmarkPerDonorPerMonth = 10; // kept for reference (unused)
        const expected_target = donors * benchmarkPerDonorPerMonth * period_months;
        const fundraising_score = 0; // recomputed below post-aggregation

        // === Donor Efficiency (PREVIOUS FULL MONTH, ignores filter) ===
        // SAR per donor in last completed calendar month vs benchmark (10 SAR/donor).
        const donor_efficiency = donors_total > 0 ? prev_month_donations / donors_total : 0;
        const donor_efficiency_score = clamp((donor_efficiency / 10) * 100);

        const donor_engagement_score = clamp(recurring_pct * 1.5 + (donors > 0 ? Math.min(40, Math.log10(donors + 1) * 12) : 0));
        const service_score = clamp(recovery_rate * 0.6 + match_rate * 0.4);
        const team_score = clamp(completion * 0.7 + Math.log10((n("employees_count")) + 1) * 10);
        const overall_score = clamp(
          (fundraising_score + donor_engagement_score + service_score + team_score) / 4
        );

        const m: OrgMetrics = {
          org_id: orgId,
          org_name: o.name,
          org_slug: o.slug,
          is_active: o.is_active,
          members: n("members"),
          donors,
          donors_total,
          donations_count,
          total_donated,
          avg_donation,
          recurring_donors: recurring,
          abandoned_carts: abandoned,
          recovered_carts: recovered,
          recovery_rate,
          failed_donations: failed,
          bank_transfers: transfers,
          matched_transfers: matched,
          campaigns: n("campaigns"),
          marketing_ideas: n("marketing_ideas"),
          insights: n("insights"),
          tasks_total: tasksTotal,
          tasks_completed: tasksDone,
          task_completion_rate: completion,
          employees_count: n("employees_count"),
          gifts_count,
          gifts_amount,
          gifts_delivered,
          gifts_delivery_rate,
          unique_gift_givers,
          failure_rate,
          match_rate,
          store_health_score,
          projects_count,
          top_project_name,
          top_project_amount,
          top_project_share,
          expected_target,
          period_months,
          prev_month_donations,
          prev_month_label: prevMonthLabel,
          donor_efficiency,
          donor_efficiency_score,
          fundraising_score,
          donor_engagement_score,
          service_score,
          team_score,
          overall_score,
        };
        return m;
      }));

      // Post-process: fundraising_score = (org_total / max_total) * 100
      const maxTotal = results.reduce((m, r) => Math.max(m, r.total_donated || 0), 0);
      const finalized = results.map((r) => {
        const fundraising_score = maxTotal > 0
          ? clamp((r.total_donated / maxTotal) * 100)
          : 0;
        const overall_score = clamp(
          (fundraising_score + r.donor_engagement_score + r.service_score + r.team_score) / 4
        );
        return { ...r, fundraising_score, overall_score };
      });

      if (!cancelled) {
        setMetrics(finalized);
        setLoading(false);
      }
    })().catch((error) => {
      if (!cancelled) {
        setMetrics([]); setLoading(false);
        setError("تعذر تحميل البيانات الكاملة. أعد المحاولة قبل استخدام الأرقام أو تصدير التقرير.");
        toast.error("تعذر تحميل بيانات التقارير. أعد المحاولة.");
        console.error("Reporting aggregate failed", error?.message);
      }
    });
    return () => { cancelled = true; };
  }, [refreshKey, fromIso, toIso]);

  return { metrics, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}
