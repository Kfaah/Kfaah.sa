// Smart Task Dispatcher
// Central distributor that converts ANY platform suggestion (daily intelligence,
// report suggestions, donor insights, upload triggers, …) into employee tasks
// while respecting per-employee daily capacity.
//
// Caps per employee per day:
//   - max 7 tasks
//   - max 300 minutes (5 hours) of estimated work
// Channel → estimated minutes:
//   call:15  whatsapp/sms:5  letter:25  visit:60  cart:7  email:8  thank_you:5

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_TASKS_PER_DAY = 7;
const MAX_MINUTES_PER_DAY = 300; // 5 hours
const MAX_HORIZON_DAYS = 14;

const CHANNEL_MINUTES: Record<string, number> = {
  call: 15,
  whatsapp: 5,
  sms: 5,
  email: 8,
  letter: 25,
  visit: 60,
  cart: 7,
  thank_you: 5,
  default: 15,
};

const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2 };

type Suggestion = {
  source: string;             // e.g. "daily_intelligence", "report:donor_tiers"
  title: string;
  description?: string;
  donor_id?: string | null;
  donor_ref?: string | null;
  channel?: string;
  priority?: "low" | "medium" | "high";
  suggested_message?: string | null;
  estimated_minutes?: number;
  due_in_days?: number;       // earliest desired due
  category?: string;
  dedupe_key?: string;
  metadata?: Record<string, unknown>;
};

function estMinutes(s: Suggestion): number {
  if (s.estimated_minutes && s.estimated_minutes > 0) {
    return Math.min(180, Math.max(3, Math.round(s.estimated_minutes)));
  }
  const ch = (s.channel || "").toLowerCase();
  return CHANNEL_MINUTES[ch] ?? CHANNEL_MINUTES.default;
}

function buildDedupeKey(s: Suggestion): string {
  if (s.dedupe_key) return s.dedupe_key.slice(0, 200);
  const base = [
    s.source || "src",
    s.donor_id || s.donor_ref || "",
    (s.title || "").trim().slice(0, 60),
  ].join("|");
  return base.slice(0, 200);
}

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const orgId: string | undefined = body.organization_id || body.organizationId;
    const incoming: Suggestion[] = Array.isArray(body.suggestions) ? body.suggestions : [];
    const dryRun: boolean = !!body.dry_run;
    const startDate = body.start_date ? new Date(body.start_date) : new Date();

    if (!orgId) return json({ error: "organization_id مطلوب" }, 400);
    if (!incoming.length) return json({ ok: true, scheduled: 0, skipped_dupes: 0, message: "no suggestions" });

    // 1) Active employees of org
    const { data: emps, error: empErr } = await supa
      .from("employees")
      .select("user_id, full_name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .not("user_id", "is", null);
    if (empErr) return json({ error: empErr.message }, 500);
    const employees = (emps || []).filter((e: any) => e.user_id) as { user_id: string; full_name: string }[];
    if (!employees.length) return json({ error: "لا يوجد موظفون نشطون" }, 400);

    // 2) Build dedupe set: existing OPEN tasks for these dedupe_keys in last 7 days
    const wantedKeys = Array.from(new Set(incoming.map(buildDedupeKey)));
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: existingDupes } = await supa
      .from("tasks")
      .select("dedupe_key")
      .eq("organization_id", orgId)
      .in("dedupe_key", wantedKeys)
      .in("status", ["pending", "in_progress", "upcoming"])
      .gte("created_at", since7);
    const dupeSet = new Set((existingDupes || []).map((r: any) => r.dedupe_key));

    // 3) Load current load per (user, date) for the horizon window
    const horizonEnd = new Date(startDate.getTime() + MAX_HORIZON_DAYS * 86400000);
    const { data: loadRows } = await supa
      .from("tasks")
      .select("user_id, due_date, estimated_time_minutes, status")
      .eq("organization_id", orgId)
      .gte("due_date", toDateOnly(startDate))
      .lte("due_date", toDateOnly(horizonEnd))
      .in("status", ["pending", "in_progress", "upcoming"]);
    // load[userId][date] = {count, minutes}
    const load = new Map<string, Map<string, { count: number; minutes: number }>>();
    const bump = (uid: string, date: string, mins: number) => {
      let u = load.get(uid);
      if (!u) { u = new Map(); load.set(uid, u); }
      let d = u.get(date);
      if (!d) { d = { count: 0, minutes: 0 }; u.set(date, d); }
      d.count += 1;
      d.minutes += mins;
    };
    for (const r of (loadRows || []) as any[]) {
      if (!r.user_id || !r.due_date) continue;
      bump(r.user_id, r.due_date, Number(r.estimated_time_minutes) || 15);
    }

    // 4) Sort suggestions: priority then earlier due first
    const queue = incoming
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => !dupeSet.has(buildDedupeKey(s)))
      .sort((a, b) => {
        const pa = PRIORITY_WEIGHT[a.s.priority || "medium"] ?? 1;
        const pb = PRIORITY_WEIGHT[b.s.priority || "medium"] ?? 1;
        if (pa !== pb) return pa - pb;
        return (a.s.due_in_days ?? 1) - (b.s.due_in_days ?? 1);
      });

    const skippedDupes = incoming.length - queue.length;

    // 5) Round-robin assign
    let cursor = 0;
    const taskRows: any[] = [];
    const overflow: Suggestion[] = [];

    for (const { s } of queue) {
      const mins = estMinutes(s);
      const earliest = Math.max(0, Number(s.due_in_days ?? 0));
      let placed = false;

      // try each day from earliest up to horizon
      for (let dayOffset = earliest; dayOffset <= MAX_HORIZON_DAYS && !placed; dayOffset++) {
        const date = toDateOnly(new Date(startDate.getTime() + dayOffset * 86400000));
        // round-robin: try every employee starting from cursor
        for (let i = 0; i < employees.length && !placed; i++) {
          const emp = employees[(cursor + i) % employees.length];
          const uMap = load.get(emp.user_id) || new Map();
          const slot = uMap.get(date) || { count: 0, minutes: 0 };
          if (slot.count < MAX_TASKS_PER_DAY && slot.minutes + mins <= MAX_MINUTES_PER_DAY) {
            // place here
            const dedupe_key = buildDedupeKey(s);
            taskRows.push({
              organization_id: orgId,
              user_id: emp.user_id,
              title: String(s.title).slice(0, 200),
              description: s.description || s.suggested_message || "",
              priority: s.priority || "medium",
              status: "pending",
              category: s.category || "متابعة المتبرعين",
              due_date: date,
              ai_generated: true,
              estimated_time_minutes: mins,
              source: s.source,
              dedupe_key,
              metadata: {
                ...(s.metadata || {}),
                channel: s.channel || null,
                suggested_message: s.suggested_message || null,
                donor_id: s.donor_id || null,
                donor_ref: s.donor_ref || null,
                source: s.source,
                dispatched_at: new Date().toISOString(),
              },
            });
            bump(emp.user_id, date, mins);
            cursor = (cursor + i + 1) % employees.length;
            placed = true;
          }
        }
      }

      if (!placed) overflow.push(s);
    }

    if (dryRun) {
      return json({
        ok: true,
        dry_run: true,
        would_schedule: taskRows.length,
        skipped_dupes: skippedDupes,
        overflow: overflow.length,
        employees: employees.length,
      });
    }

    let scheduled = 0;
    if (taskRows.length) {
      const { error, count } = await supa.from("tasks").insert(taskRows, { count: "exact" });
      if (error) {
        console.error("dispatcher insert error", error);
        return json({ error: error.message }, 500);
      }
      scheduled = count || taskRows.length;
    }

    return json({
      ok: true,
      scheduled,
      skipped_dupes: skippedDupes,
      overflow: overflow.length,
      employees: employees.length,
    });
  } catch (e: any) {
    console.error("smart-task-dispatcher error", e);
    return json({ error: e?.message || "خطأ غير متوقع" }, 500);
  }
});