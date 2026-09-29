// Edge Function: process-upload
// Receives an Excel file, auto-detects its type, parses it, and inserts rows
// into the appropriate table (donations, abandoned_carts, campaigns, etc.).
// Logs everything in data_uploads_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DetectedType =
  | "donations"
  | "failed_donations"
  | "bank_transfers"
  | "abandoned_carts"
  | "campaigns"
  | "subscriptions"
  | "gifts"
  | "unknown";

// Normalize Arabic header text for matching
function normalize(s: string): string {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Heuristic file-type detection based on headers
function detectType(headers: string[]): DetectedType {
  const h = headers.map(normalize);
  const has = (kw: string[]) => kw.some((k) => h.some((x) => x.includes(normalize(k))));

  if (has(["السله", "السلال", "متروكه", "متروكة", "abandoned"])) return "abandoned_carts";
  if (has(["تحويل بنكي", "التحويلات البنكيه", "bank transfer", "رقم التحويل"])) return "bank_transfers";
  if (has(["استقطاع", "اشتراك", "subscription", "شهري"])) return "subscriptions";
  if (has(["حمله", "حملات", "campaign", "هدف الحمله"])) return "campaigns";
  if (has(["اهداء", "إهداء", "gift", "المهدى اليه", "المهدي اليه"])) return "gifts";
  if (has(["فاشله", "فاشلة", "failed", "سبب الفشل"])) return "failed_donations";
  // default — donations report (most common)
  if (has(["تبرع", "donation", "مبلغ", "متبرع"])) return "donations";
  return "unknown";
}

// Find a column value in a row by trying multiple possible header names
function pick(row: Record<string, unknown>, ...candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const nc = normalize(cand);
    const k = keys.find((key) => normalize(key).includes(nc));
    if (k && row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  // Excel serial date
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0)).toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const yyyy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(yyyy, Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(dt.getTime())) return dt.toISOString();
  }
  return null;
}

// Map a row → record for the appropriate table
function mapRow(type: DetectedType, row: Record<string, unknown>, orgId: string, uploadId: string) {
  const raw = row;
  switch (type) {
    case "donations":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        donation_number: String(pick(row, "رقم التبرع", "رقم العملية", "donation number", "رقم العمليه") ?? crypto.randomUUID()),
        amount: toNumber(pick(row, "المبلغ", "amount", "قيمه التبرع", "قيمة التبرع")) ?? 0,
        currency: String(pick(row, "العمله", "currency") ?? "SAR"),
        donation_date: toDate(pick(row, "تاريخ التبرع", "التاريخ", "date")) ?? new Date().toISOString(),
        donor_name: pick(row, "اسم المتبرع", "المتبرع", "donor name") as string | null,
        donor_phone: pick(row, "الجوال", "رقم الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "اسم المشروع", "project") as string | null,
        payment_method: pick(row, "طريقه الدفع", "طريقة الدفع", "payment method") as string | null,
        source: pick(row, "المصدر", "source", "القناه") as string | null,
        status: "success",
        raw_data: raw,
      };
    case "failed_donations":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")),
        attempted_at: toDate(pick(row, "التاريخ", "تاريخ المحاوله", "date")) ?? new Date().toISOString(),
        donor_name: pick(row, "اسم المتبرع", "donor name") as string | null,
        donor_phone: pick(row, "الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        payment_method: pick(row, "طريقه الدفع", "payment method") as string | null,
        failure_reason: pick(row, "سبب الفشل", "failure reason", "السبب") as string | null,
        raw_data: raw,
      };
    case "bank_transfers":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")) ?? 0,
        transfer_date: toDate(pick(row, "تاريخ التحويل", "التاريخ", "date")) ?? new Date().toISOString(),
        transfer_number: pick(row, "رقم التحويل", "transfer number") as string | null,
        bank_name: pick(row, "البنك", "اسم البنك", "bank") as string | null,
        sender_name: pick(row, "اسم المحول", "المرسل", "sender") as string | null,
        sender_phone: pick(row, "جوال المحول", "phone") as string | null,
        notes: pick(row, "ملاحظات", "notes") as string | null,
        raw_data: raw,
      };
    case "abandoned_carts":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        abandoned_at: toDate(pick(row, "تاريخ السله", "تاريخ السلة", "التاريخ", "date")) ?? new Date().toISOString(),
        amount: toNumber(pick(row, "المبلغ", "amount")),
        donor_name: pick(row, "اسم المتبرع", "donor") as string | null,
        donor_phone: pick(row, "الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        raw_data: raw,
      };
    case "campaigns":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        name: String(pick(row, "اسم الحمله", "اسم الحملة", "campaign name", "الاسم") ?? "حملة"),
        description: pick(row, "الوصف", "description") as string | null,
        goal_amount: toNumber(pick(row, "هدف الحمله", "هدف الحملة", "goal", "الهدف")),
        collected_amount: toNumber(pick(row, "المحصل", "collected", "المبلغ المحصل")) ?? 0,
        donations_count: toNumber(pick(row, "عدد التبرعات", "donations count")) ?? 0,
        start_date: toDate(pick(row, "تاريخ البدايه", "تاريخ البداية", "start date"))?.split("T")[0] ?? null,
        end_date: toDate(pick(row, "تاريخ النهايه", "تاريخ النهاية", "end date"))?.split("T")[0] ?? null,
        status: "active",
        raw_data: raw,
      };
    case "subscriptions":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")) ?? 0,
        start_date: toDate(pick(row, "تاريخ البدايه", "تاريخ البداية", "start date")) ?? new Date().toISOString(),
        donor_name: pick(row, "اسم المتبرع", "donor") as string | null,
        donor_phone: pick(row, "الجوال", "phone") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        status: String(pick(row, "الحاله", "الحالة", "status") ?? "active"),
        raw_data: raw,
      };
    case "gifts":
      return {
        organization_id: orgId,
        upload_id: uploadId,
        amount: toNumber(pick(row, "المبلغ", "amount")) ?? 0,
        gift_date: toDate(pick(row, "تاريخ الاهداء", "التاريخ", "date")),
        giver_name: pick(row, "اسم المهدي", "المهدي", "giver") as string | null,
        giver_phone: pick(row, "جوال المهدي", "phone") as string | null,
        recipient_name: pick(row, "المهدى اليه", "المهدي اليه", "recipient") as string | null,
        recipient_phone: pick(row, "جوال المهدى اليه", "recipient phone") as string | null,
        occasion: pick(row, "المناسبه", "المناسبة", "occasion") as string | null,
        message: pick(row, "الرساله", "الرسالة", "message") as string | null,
        project_name: pick(row, "المشروع", "project") as string | null,
        raw_data: raw,
      };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // User-scoped client to verify identity & org
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Service client for inserts (bypasses RLS so we can attribute org cleanly)
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve organization
    const { data: orgRow } = await admin
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("approval_status", "approved")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();

    let organizationId = orgRow?.organization_id;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const forDate = form.get("for_date") as string | null;
    const targetOrgId = (form.get("target_organization_id") as string | null) || null;
    const sourceKind = (form.get("source_kind") as string | null) || null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Missing file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cross-organization targeting is allowed only for a platform
    // super admin or an admin explicitly scoped to the target organization.
    if (targetOrgId && targetOrgId !== organizationId) {
      const [{ data: roleRows }, { data: targetMembership }] =
        await Promise.all([
          admin
            .from("user_roles")
            .select("role, organization_id")
            .eq("user_id", userId),
          admin
            .from("user_organizations")
            .select("id")
            .eq("user_id", userId)
            .eq("organization_id", targetOrgId)
            .eq("approval_status", "approved")
            .maybeSingle(),
        ]);

      const isSuper = (roleRows ?? []).some(
        (r) => r.role === "super_admin",
      );
      const isTargetAdmin = (roleRows ?? []).some(
        (r) =>
          r.role === "admin" &&
          r.organization_id === targetOrgId,
      );

      if (isSuper || (isTargetAdmin && targetMembership)) {
        organizationId = targetOrgId;
      } else {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "User has no organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const autoDetected = detectType(headers);
    // يسمح للواجهة بفرض نوع الملف (مثلاً عند رفع المستخدم لملف "إهداءات" صريح)
    // تجاوزات معتمدة فقط — أي قيمة أخرى تُتجاهل ويُعتمد الكشف التلقائي.
    const allowedOverrides: DetectedType[] = [
      "donations",
      "failed_donations",
      "bank_transfers",
      "abandoned_carts",
      "campaigns",
      "subscriptions",
      "gifts",
    ];
    const detected: DetectedType =
      sourceKind && allowedOverrides.includes(sourceKind as DetectedType)
        ? (sourceKind as DetectedType)
        : autoDetected;

    // Create upload log
    const { data: logRow, error: logErr } = await admin
      .from("data_uploads_log")
      .insert({
        organization_id: organizationId,
        uploaded_by: userId,
        file_name: file.name,
        file_type: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        for_date: forDate,
        detected_schema: detected,
        total_rows: rows.length,
        status: "processing",
      })
      .select()
      .single();
    if (logErr) throw logErr;
    const uploadId = logRow.id;

    // Upload original file to storage
    const storagePath = `${organizationId}/${uploadId}_${file.name}`;
    await admin.storage.from("data-uploads").upload(storagePath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (detected === "unknown") {
      await admin
        .from("data_uploads_log")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_log: { reason: "Unable to detect file type", headers },
        })
        .eq("id", uploadId);
      return new Response(
        JSON.stringify({ uploadId, detected, inserted: 0, failed: rows.length, message: "نوع الملف غير معروف" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Map and insert
    const records: Record<string, unknown>[] = [];
    const errors: { row: number; error: string }[] = [];
    rows.forEach((r, i) => {
      try {
        const mapped = mapRow(detected, r, organizationId, uploadId);
        if (mapped) records.push(mapped);
      } catch (e) {
        errors.push({ row: i + 2, error: e instanceof Error ? e.message : String(e) });
      }
    });

    let inserted = 0;
    let duplicates = 0;
    // Insert in batches of 500
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error: insErr, count } = await admin
        .from(detected)
        .insert(batch, { count: "exact" });
      if (insErr) {
        // If duplicate constraint, count duplicates
        if (insErr.code === "23505") {
          duplicates += batch.length;
        } else {
          errors.push({ row: i + 2, error: insErr.message });
        }
      } else {
        inserted += count ?? batch.length;
      }
    }

    await admin
      .from("data_uploads_log")
      .update({
        status: errors.length === 0 ? "completed" : "completed_with_errors",
        completed_at: new Date().toISOString(),
        inserted_rows: inserted,
        failed_rows: errors.length,
        duplicate_rows: duplicates,
        error_log: errors.length > 0 ? { errors: errors.slice(0, 100) } : null,
      })
      .eq("id", uploadId);

    // Fire-and-forget: trigger innovation suggestions based on this fresh data.
    // We don't await it so the upload response stays fast.
    if (inserted > 0) {
      try {
        // 1) Invalidate cached deep-analysis & comparison insights for this org
        //    so the next visit to "النظرة العامة / التحليل العميق / المقارنة"
        //    regenerates fresh results that include the new data.
        admin
          .from("admin_ai_insights_cache")
          .delete()
          .eq("organization_id", organizationId)
          .then(({ error }) => {
            if (error) console.error("cache invalidation failed:", error);
          });

        // 2) Trigger the full intelligence engine: deep insights, smart tasks,
        //    marketing ideas, lifecycle events — all bound to this upload.
        fetch(`${supabaseUrl}/functions/v1/run-intelligence`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            organizationId,
            triggerSource: "upload",
            uploadId,
            scope: [detected],
          }),
        }).catch((err) => console.error("run-intelligence trigger failed:", err));

        // 3) Innovation suggestions tailored to this file
        const minimalMetrics = {
          org_name: "الجمعية",
          total_donated: 0, donations_count: inserted, avg_donation: 0,
          donors: 0, donors_total: 0, recurring_donors: 0,
          abandoned_carts: 0, recovered_carts: 0, recovery_rate: 0,
          bank_transfers: 0, matched_transfers: 0, match_rate: 0,
          failed_donations: 0, failure_rate: 0,
          gifts_count: 0, gifts_amount: 0, gifts_delivery_rate: 0,
          projects_count: 0, top_project_name: "—", top_project_share: 0,
          employees_count: 0, tasks_total: 0, task_completion_rate: 0,
          campaigns: 0, marketing_ideas: 0, insights: 0,
          fundraising_score: 0, donor_engagement_score: 0,
          service_score: 0, team_score: 0, store_health_score: 0,
        };
        fetch(`${supabaseUrl}/functions/v1/innovation-suggestions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            metrics: minimalMetrics,
            period_label: `بيانات جديدة من ${file.name}`,
            focus: `ملف ${detected} تم رفعه للتو يحوي ${inserted} سجلًا. اقترح كيف نستفيد منها في المنصة.`,
          }),
        })
          .then(async (r) => {
            if (!r.ok) return;
            const j = await r.json();
            const items = (j?.suggestions || []) as any[];
            if (!items.length) return;
            const rows = items.map((s) => ({
              organization_id: organizationId,
              title: s.title,
              summary: s.summary,
              category: s.category || "feature",
              area: s.area || null,
              priority: s.priority || "medium",
              impact: s.impact || null,
              effort: s.effort || null,
              data_basis: {
                source: "upload",
                upload_id: uploadId,
                file_name: file.name,
                detected,
                note: typeof s.data_basis === "string" ? s.data_basis : (s.data_basis?.note || ""),
              },
              ai_model: j?.model || "google/gemini-3-flash-preview",
            }));
            await admin.from("innovation_suggestions").insert(rows);
          })
          .catch((err) => console.error("innovation trigger failed:", err));
      } catch (err) {
        console.error("innovation trigger setup failed:", err);
      }
    }

    return new Response(
      JSON.stringify({
        uploadId,
        detected,
        total: rows.length,
        inserted,
        duplicates,
        failed: errors.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-upload error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
