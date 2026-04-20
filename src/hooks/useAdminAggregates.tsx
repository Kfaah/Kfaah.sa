import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrgMetrics {
  org_id: string;
  org_name: string;
  org_slug: string | null;
  is_active: boolean;
  members: number;
  donors: number;
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
  // composite scores (0..100)
  fundraising_score: number;
  donor_engagement_score: number;
  service_score: number;
  team_score: number;
  overall_score: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function useAdminAggregates() {
  const [metrics, setMetrics] = useState<OrgMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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

        const [
          membersRes, donorsRes, donCountRes, donSumRes,
          abCartsRes, abRecoveredRes, failedRes,
          transfersRes, matchedRes,
          campaignsRes, ideasRes, insightsRes,
          tasksTotalRes, tasksDoneRes, employeesRes,
        ] = await Promise.all([
          supabase.from("user_organizations").select("*", head).eq("organization_id", orgId),
          supabase.from("donors").select("*", head).eq("organization_id", orgId),
          supabase.from("donations").select("*", head).eq("organization_id", orgId),
          supabase.from("donations").select("amount").eq("organization_id", orgId).limit(10000),
          supabase.from("abandoned_carts").select("*", head).eq("organization_id", orgId),
          supabase.from("abandoned_carts").select("*", head).eq("organization_id", orgId).eq("recovered", true),
          supabase.from("failed_donations").select("*", head).eq("organization_id", orgId),
          supabase.from("bank_transfers").select("*", head).eq("organization_id", orgId),
          supabase.from("bank_transfers").select("*", head).eq("organization_id", orgId).eq("reconciliation_status", "matched"),
          supabase.from("campaigns").select("*", head).eq("organization_id", orgId),
          supabase.from("marketing_ideas").select("*", head).eq("organization_id", orgId),
          supabase.from("donor_insights").select("*", head).eq("organization_id", orgId),
          supabase.from("tasks").select("*", head).eq("organization_id", orgId),
          supabase.from("tasks").select("*", head).eq("organization_id", orgId).eq("status", "completed"),
          supabase.from("employees").select("*", head).eq("organization_id", orgId),
        ]);

        const recurringRes = await supabase
          .from("donors").select("*", head)
          .eq("organization_id", orgId).gte("donations_count", 2);

        const total_donated = (donSumRes.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
        const donations_count = donCountRes.count || 0;
        const donors = donorsRes.count || 0;
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
        const recurring_pct = donors ? (recurring / donors) * 100 : 0;

        // Composite scores (relative-friendly, will be normalized by caller if needed)
        const fundraising_score = clamp(
          Math.log10(total_donated + 1) * 12 + Math.log10(donations_count + 1) * 8
        );
        const donor_engagement_score = clamp(recurring_pct * 1.2 + Math.log10(donors + 1) * 8);
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
  }, [refreshKey]);

  return { metrics, loading, refresh: () => setRefreshKey((k) => k + 1) };
}
