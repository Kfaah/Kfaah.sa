// Top-Up Employee Tasks
// Adaptive filler: for each active employee in an org, computes today's used
// minutes (estimated for open tasks + actual for completed today), and if
// remaining capacity ≥ 30 min and tasks-count < 7, pulls suggestions from the
// pending smart_tasks bank and dispatches them via smart-task-dispatcher
// targeting that specific employee. If bank is empty, kicks off a new
// daily-donor-intelligence run with trigger=top_up.

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

const MAX_TASKS = 7;
const MAX_MIN = 300;
const MIN_FILL = 30; // require at least 30 min free before topping up
const HARD_TASKS_CAP = 14; // never dispatch more than this in a single day, even for fast employees

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
    const onlyUser: string | undefined = body.user_id;
    if (!orgId) return json({ error: "organization_id مطلوب" }, 400);

    const today = new Date().toISOString().slice(0, 10);

    // Active employees
    let q = supa.from("employees")
      .select("user_id, full_name")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .not("user_id", "is", null);
    if (onlyUser) q = q.eq("user_id", onlyUser);
    const { data: emps } = await q;
    const employees = (emps || []) as { user_id: string; full_name: string }[];
    if (!employees.length) return json({ ok: true, filled: 0, message: "no active employees" });

    // Today's tasks for these employees
    const ids = employees.map((e) => e.user_id);
    const { data: tks } = await supa
      .from("tasks")
      .select("user_id, status, due_date, estimated_time_minutes, actual_time_minutes")
      .eq("organization_id", orgId)
      .in("user_id", ids)
      .eq("due_date", today);

    type Slot = { open: number; done: number; minutes: number; expectedDone: number; actualDone: number };
    const usage = new Map<string, Slot>();
    for (const t of (tks || []) as any[]) {
      const s = usage.get(t.user_id) || { open: 0, done: 0, minutes: 0, expectedDone: 0, actualDone: 0 };
      const isOpen = ["pending", "in_progress", "upcoming"].includes(t.status);
      const isDone = ["completed", "executed"].includes(t.status);
      const est = Number(t.estimated_time_minutes) || 15;
      const act = Number(t.actual_time_minutes) || 0;
      if (isOpen) {
        s.open += 1;
        s.minutes += est;
      } else if (isDone) {
        // count actual time as already-used capacity but no open slot
        s.done += 1;
        s.minutes += act || est;
        s.expectedDone += est;
        s.actualDone += act || est;
      }
      usage.set(t.user_id, s);
    }

    // Pull recent pace factor per employee (last 30 days, completed tasks)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: hist } = await supa
      .from("tasks")
      .select("user_id, estimated_time_minutes, actual_time_minutes")
      .eq("organization_id", orgId)
      .in("user_id", ids)
      .in("status", ["completed", "executed"])
      .gte("updated_at", since)
      .limit(2000);
    const pace = new Map<string, number>(); // actual / expected, clamped 0.4..2.5 ; <1 = fast
    const accum = new Map<string, { e: number; a: number }>();
    for (const r of (hist || []) as any[]) {
      const e = Number(r.estimated_time_minutes) || 0;
      const a = Number(r.actual_time_minutes) || 0;
      if (e <= 0 || a <= 0) continue;
      const cur = accum.get(r.user_id) || { e: 0, a: 0 };
      cur.e += e;
      cur.a += a;
      accum.set(r.user_id, cur);
    }
    for (const [uid, v] of accum.entries()) {
      if (v.e > 0) pace.set(uid, Math.max(0.4, Math.min(2.5, v.a / v.e)));
    }

    // Pending smart_tasks bank for this org (not yet dispatched)
    const { data: bank } = await supa
      .from("smart_tasks")
      .select("id, title, description, suggested_message, suggested_channel, priority, category, context")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .eq("ai_generated", true)
      .order("created_at", { ascending: false })
      .limit(200);
    const pool = ((bank || []) as any[]).map((t) => ({
      source: "top_up_bank",
      title: t.title,
      description: t.description,
      donor_ref: t.context?.donor_ref || null,
      channel: t.context?.channel || t.suggested_channel || null,
      priority: t.priority || "medium",
      suggested_message: t.suggested_message || null,
      category: t.category || "متابعة",
      due_in_days: 0,
      dedupe_key: `top_up|${t.id}`,
      metadata: { source_smart_task_id: t.id },
    }));

    let filled = 0;
    const reports: any[] = [];

    for (const emp of employees) {
      const slot = usage.get(emp.user_id) || { open: 0, done: 0, minutes: 0, expectedDone: 0, actualDone: 0 };
      const paceFactor = pace.get(emp.user_id) ?? 1.0; // <1 fast, >1 slow

      // Effective per-employee daily caps:
      //  - fast workers (paceFactor < 1): allow more tasks (up to HARD_TASKS_CAP)
      //  - slow workers: still cap at MAX_TASKS, BUT today's "slowness signal"
      //    (actualDone > expectedDone*1.5) means we keep filling time anyway —
      //    they don't get to coast for the whole shift on too few tasks.
      const isSlowToday = slot.expectedDone > 0 && slot.actualDone > slot.expectedDone * 1.5;
      const effectiveMaxTasks = paceFactor < 0.9
        ? Math.min(HARD_TASKS_CAP, Math.round(MAX_TASKS / paceFactor))
        : isSlowToday
          ? MAX_TASKS + 2 // give them a couple extra small tasks instead of letting time fill with one task
          : MAX_TASKS;

      const remainingTasks = effectiveMaxTasks - slot.open;
      const remainingMin = MAX_MIN - slot.minutes;
      if (remainingTasks <= 0 || remainingMin < MIN_FILL) {
        reports.push({
          user: emp.full_name,
          action: "skip_full",
          remainingTasks,
          remainingMin,
          paceFactor: Number(paceFactor.toFixed(2)),
          slow_today: isSlowToday,
        });
        continue;
      }
      // pull a slice (cap at remainingTasks)
      const slice = pool.splice(0, Math.min(remainingTasks, HARD_TASKS_CAP));
      if (!slice.length) {
        reports.push({
          user: emp.full_name,
          action: "no_bank",
          remainingTasks,
          remainingMin,
          paceFactor: Number(paceFactor.toFixed(2)),
        });
        continue;
      }
      const dispResp = await fetch(`${SUPABASE_URL}/functions/v1/smart-task-dispatcher`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          organization_id: orgId,
          target_user_id: emp.user_id,
          suggestions: slice,
          // tell the dispatcher to honor a per-employee daily cap
          max_tasks_today: effectiveMaxTasks,
        }),
      });
      if (dispResp.ok) {
        const dj = await dispResp.json();
        filled += dj?.scheduled || 0;
        reports.push({
          user: emp.full_name,
          scheduled: dj?.scheduled,
          overflow: dj?.overflow,
          paceFactor: Number(paceFactor.toFixed(2)),
          effectiveMaxTasks,
          slow_today: isSlowToday,
        });
      } else {
        reports.push({ user: emp.full_name, action: "dispatch_failed", status: dispResp.status });
      }
    }

    return json({ ok: true, filled, employees: employees.length, reports });
  } catch (e: any) {
    console.error("top-up-employee-tasks error", e);
    return json({ error: e?.message || "خطأ غير متوقع" }, 500);
  }
});