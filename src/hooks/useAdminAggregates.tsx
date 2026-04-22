import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [refreshKey, setRefreshKey] = useState(0);

  const fromIso = range?.from ? range.from.toISOString() : null;
  const toIso = range?.to ? range.to.toISOString() : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, slug, is_active")
        .order("created_at", { ascending: true });

      if (!orgs) { if (!cancelled) { setMetrics([]); setLoading(false); } return; }

      const results = await Promise.all(orgs.map(async (o) => {
        const orgId = o.id;
        const head = { count: "exact" as const, head: true };

        // Helper to apply date range to a query on a date column
        const withRange = (q: any, col: string) => {
          if (fromIso) q = q.gte(col, fromIso);
          if (toIso) q = q.lte(col, toIso);
          return q;
        };

        // Previous full calendar month bounds (independent of filter)
        const _now = new Date();
        const prevMonthEnd = new Date(_now.getFullYear(), _now.getMonth(), 0, 23, 59, 59, 999);
        const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1, 0, 0, 0, 0);
        const prevMonthLabel = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, "0")}`;

        const [
          membersRes, donorsTotalRes, donCountRes, donSumRes, activeDonorsRes,
          abCartsRes, abRecoveredRes, failedRes,
          transfersRes, matchedRes,
          campaignsRes, ideasRes, insightsRes,
          tasksTotalRes, tasksDoneRes, employeesRes,
          giftsCountRes, giftsRowsRes, giftsDeliveredRes,
        ] = await Promise.all([
          supabase.from("user_organizations").select("*", head).eq("organization_id", orgId),
          supabase.from("donors").select("*", head).eq("organization_id", orgId),
          withRange(supabase.from("donations").select("*", head).eq("organization_id", orgId), "donation_date"),
          withRange(supabase.from("donations").select("amount, donor_id, donor_phone, project_name").eq("organization_id", orgId), "donation_date").limit(20000),
          // active donors derived from donations result; placeholder
          Promise.resolve({ data: null, count: null } as any),
          withRange(supabase.from("abandoned_carts").select("*", head).eq("organization_id", orgId), "abandoned_at"),
          withRange(supabase.from("abandoned_carts").select("*", head).eq("organization_id", orgId).eq("recovered", true), "abandoned_at"),
          withRange(supabase.from("failed_donations").select("*", head).eq("organization_id", orgId), "attempted_at"),
          withRange(supabase.from("bank_transfers").select("*", head).eq("organization_id", orgId), "transfer_date"),
          withRange(supabase.from("bank_transfers").select("*", head).eq("organization_id", orgId).eq("reconciliation_status", "matched"), "transfer_date"),
          supabase.from("campaigns").select("*", head).eq("organization_id", orgId),
          supabase.from("marketing_ideas").select("*", head).eq("organization_id", orgId),
          supabase.from("donor_insights").select("*", head).eq("organization_id", orgId),
          withRange(supabase.from("tasks").select("*", head).eq("organization_id", orgId), "created_at"),
          withRange(supabase.from("tasks").select("*", head).eq("organization_id", orgId).eq("status", "completed"), "created_at"),
          supabase.from("employees").select("*", head).eq("organization_id", orgId),
          withRange(supabase.from("gifts").select("*", head).eq("organization_id", orgId), "gift_date"),
          withRange(supabase.from("gifts").select("amount, giver_donor_id, giver_phone, delivery_status").eq("organization_id", orgId), "gift_date").limit(20000),
          withRange(supabase.from("gifts").select("*", head).eq("organization_id", orgId).eq("delivery_status", "delivered"), "gift_date"),
        ]);

        const recurringRes = await supabase
          .from("donors").select("*", head)
          .eq("organization_id", orgId).gte("donations_count", 2);

        // Previous full month donations (independent of selected filter)
        const prevMonthRes = await supabase
          .from("donations")
          .select("amount")
          .eq("organization_id", orgId)
          .gte("donation_date", prevMonthStart.toISOString())
          .lte("donation_date", prevMonthEnd.toISOString())
          .limit(20000);
        const prev_month_donations = (prevMonthRes.data || []).reduce(
          (s: number, r: any) => s + Number(r.amount || 0), 0
        );

        const donRows = (donSumRes.data || []) as any[];
        const total_donated = donRows.reduce((s, r) => s + Number(r.amount || 0), 0);
        // active donors in period: distinct donor_id (or phone fallback)
        const activeSet = new Set<string>();
        donRows.forEach(r => {
          const k = r.donor_id || r.donor_phone;
          if (k) activeSet.add(String(k));
        });
        const active_donors = activeSet.size;

        // === Projects breakdown from donations ===
        const projectMap = new Map<string, number>();
        donRows.forEach(r => {
          const name = (r.project_name || "").toString().trim();
          if (!name) return;
          projectMap.set(name, (projectMap.get(name) || 0) + Number(r.amount || 0));
        });
        const projects_count = projectMap.size;
        let top_project_name: string | null = null;
        let top_project_amount = 0;
        for (const [name, amt] of projectMap) {
          if (amt > top_project_amount) { top_project_amount = amt; top_project_name = name; }
        }
        const top_project_share = total_donated > 0 ? (top_project_amount / total_donated) * 100 : 0;

        // === Gifts ===
        const giftRows = (giftsRowsRes.data || []) as any[];
        const gifts_count = giftsCountRes.count || 0;
        const gifts_amount = giftRows.reduce((s, r) => s + Number(r.amount || 0), 0);
        const gifts_delivered = giftsDeliveredRes.count || 0;
        const gifts_delivery_rate = gifts_count ? (gifts_delivered / gifts_count) * 100 : 0;
        const giverSet = new Set<string>();
        giftRows.forEach(r => {
          const k = r.giver_donor_id || r.giver_phone;
          if (k) giverSet.add(String(k));
        });
        const unique_gift_givers = giverSet.size;

        const donations_count = donCountRes.count || 0;
        const donors_total = donorsTotalRes.count || 0;
        const donors = active_donors > 0 ? active_donors : (fromIso || toIso ? 0 : donors_total);
        const recurring = recurringRes.count || 0;
        const abandoned = abCartsRes.count || 0;
        const recovered = abRecoveredRes.count || 0;
        const transfers = transfersRes.count || 0;
        const matched = matchedRes.count || 0;
        const tasksTotal = tasksTotalRes.count || 0;
        const tasksDone = tasksDoneRes.count || 0;
        const failed = failedRes.count || 0;

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
        const team_score = clamp(completion * 0.7 + Math.log10((employeesRes.count || 0) + 1) * 10);
        const overall_score = clamp(
          (fundraising_score + donor_engagement_score + service_score + team_score) / 4
        );

        const m: OrgMetrics = {
          org_id: orgId,
          org_name: o.name,
          org_slug: o.slug,
          is_active: o.is_active,
          members: membersRes.count || 0,
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
          campaigns: campaignsRes.count || 0,
          marketing_ideas: ideasRes.count || 0,
          insights: insightsRes.count || 0,
          tasks_total: tasksTotal,
          tasks_completed: tasksDone,
          task_completion_rate: completion,
          employees_count: employeesRes.count || 0,
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
    })();
    return () => { cancelled = true; };
  }, [refreshKey, fromIso, toIso]);

  return { metrics, loading, refresh: () => setRefreshKey((k) => k + 1) };
}
