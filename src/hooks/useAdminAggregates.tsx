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
  // contextual
  expected_target: number;    // active_donors × 10 × months_in_period
  period_months: number;
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

        const [
          membersRes, donorsTotalRes, donCountRes, donSumRes, activeDonorsRes,
          abCartsRes, abRecoveredRes, failedRes,
          transfersRes, matchedRes,
          campaignsRes, ideasRes, insightsRes,
          tasksTotalRes, tasksDoneRes, employeesRes,
        ] = await Promise.all([
          supabase.from("user_organizations").select("*", head).eq("organization_id", orgId),
          supabase.from("donors").select("*", head).eq("organization_id", orgId),
          withRange(supabase.from("donations").select("*", head).eq("organization_id", orgId), "donation_date"),
          withRange(supabase.from("donations").select("amount, donor_id, donor_phone").eq("organization_id", orgId), "donation_date").limit(20000),
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
        ]);

        const recurringRes = await supabase
          .from("donors").select("*", head)
          .eq("organization_id", orgId).gte("donations_count", 2);

        const donRows = (donSumRes.data || []) as any[];
        const total_donated = donRows.reduce((s, r) => s + Number(r.amount || 0), 0);
        // active donors in period: distinct donor_id (or phone fallback)
        const activeSet = new Set<string>();
        donRows.forEach(r => {
          const k = r.donor_id || r.donor_phone;
          if (k) activeSet.add(String(k));
        });
        const active_donors = activeSet.size;
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

        // Period in months
        const now = new Date();
        const fromD = range?.from || new Date(2000, 0, 1);
        const toD = range?.to || now;
        const period_months = monthsBetween(fromD, toD);

        // === New Fundraising Score ===
        // expected = active_donors × 10 SAR × months
        // score = (collected / expected) × 100, capped 0..100
        const benchmarkPerDonorPerMonth = 10;
        const expected_target = donors * benchmarkPerDonorPerMonth * period_months;
        const fundraising_score = expected_target > 0
          ? clamp((total_donated / expected_target) * 100)
          : 0;

        const donor_engagement_score = clamp(recurring_pct * 1.5 + (donors > 0 ? Math.min(40, Math.log10(donors + 1) * 12) : 0));
        const service_score = clamp(recovery_rate * 0.6 + match_rate * 0.4);
        const team_score = clamp(completion * 0.7 + Math.log10((employeesRes.count || 0) + 1) * 10);
        const overall_score = clamp(
          fundraising_score * 0.35 + donor_engagement_score * 0.25 +
          service_score * 0.2 + team_score * 0.2
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
          expected_target,
          period_months,
          fundraising_score,
          donor_engagement_score,
          service_score,
          team_score,
          overall_score,
        };
        return m;
      }));

      if (!cancelled) {
        setMetrics(results);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey, fromIso, toIso]);

  return { metrics, loading, refresh: () => setRefreshKey((k) => k + 1) };
}
