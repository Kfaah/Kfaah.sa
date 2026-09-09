import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageGuide } from "@/components/layout/PageGuide";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Database,
  AlertCircle,
  HeartHandshake,
  Users,
  FileText,
  IdCard,
  ListChecks,
  FolderOpen,
  Sparkles,
  Repeat,
  Megaphone,
  Gift,
  ShoppingCart,
  Eye,
  Download,
  X,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SmartPdfViewer } from "@/components/profile/SmartPdfViewer";

type UploadStatus = "queued" | "uploading" | "success" | "error";

type UploadCategory =
  | "auto"
  | "store_master"
  | "store_daily"
  | "subscriptions"
  | "campaigns"
  | "gifts"
  | "abandoned_carts"
  | "staff_duties"
  | "reports"
  | "profiles"
  | "tasks"
  | "other";

interface PendingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  category: UploadCategory;
  result?: {
    detected: string;
    inserted: number;
    duplicates: number;
    failed: number;
    matched?: number;
    archivedOnly?: boolean;
  };
  error?: string;
}

interface HistoryRow {
  id: string;
  file_name: string;
  detected_schema: string | null;
  status: string;
  total_rows: number;
  inserted_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  for_date: string | null;
  created_at: string;
  completed_at: string | null;
  file_path: string | null;
  storage_bucket: string | null;
  file_type: string | null;
  organization_id: string | null;
  file_size_bytes: number | null;
  ai_analysis: Record<string, any> | null;
  ai_analyzed_at: string | null;
}

const MAX_AI_ANALYSIS_BYTES = 30 * 1024 * 1024;

const safeStorageFileName = (name: string) => {
  const extension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  return `${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
};


// هوية حرف: تركوازي (primary/accent) + لمسة كهرمانية دافئة محدودة للجمالية.
const BRAND_BG = "bg-[hsl(var(--primary))]";
const BRAND_BG_SOFT = "bg-[hsl(var(--accent))]";
const BRAND_BG_WARM = "bg-[hsl(38_85%_55%)]"; // كهرماني دافئ — accent جمالي محدود
const BRAND_GRADIENT = "from-[hsl(var(--primary))] to-[hsl(var(--accent))]";
const BRAND_GRADIENT_SOFT = "from-[hsl(var(--accent))] to-[hsl(var(--primary))]";
const BRAND_GRADIENT_WARM = "from-[hsl(var(--primary))] to-[hsl(38_85%_55%)]"; // تركوازي → كهرماني

const SCHEMA_LABELS: Record<string, { label: string; color: string }> = {
  donations: { label: "تبرعات", color: BRAND_BG },
  store_master: { label: "ملف المتجر (الضخم)", color: BRAND_BG },
  store_daily: { label: "تبرعات المتجر اليومية", color: BRAND_BG_SOFT },
  failed_donations: { label: "تبرعات فاشلة", color: "bg-destructive" },
  bank_transfers: { label: "تحويلات بنكية", color: BRAND_BG },
  abandoned_carts: { label: "سلال متروكة", color: BRAND_BG_WARM },
  campaigns: { label: "حملات", color: BRAND_BG_WARM },
  subscriptions: { label: "استقطاعات/اشتراكات", color: BRAND_BG },
  gifts: { label: "إهداءات", color: BRAND_BG_WARM },
  staff_duties: { label: "مهام الموظفين", color: BRAND_BG },
  reports: { label: "تقارير", color: BRAND_BG_SOFT },
  profiles: { label: "ملفات تعريفية", color: BRAND_BG },
  tasks: { label: "مهام", color: BRAND_BG_SOFT },
  other: { label: "ملفات أخرى", color: "bg-muted-foreground" },
  archived: { label: "مؤرشف", color: "bg-muted-foreground" },
  unknown: { label: "غير معروف", color: "bg-muted-foreground" },
};

const CATEGORY_OPTIONS: {
  value: UploadCategory;
  label: string;
  desc: string;
  icon: any;
  color: string;
}[] = [
  { value: "auto", label: "بيانات عامة عن الجمعية", desc: "أي بيانات عامة عن الجمعية", icon: Sparkles, color: BRAND_GRADIENT_WARM },
  { value: "store_master", label: "ملف المتجر (الضخم)", desc: "ملف تبرعات المتجر منذ تأسيس المتجر", icon: Database, color: BRAND_GRADIENT },
  { value: "store_daily", label: "تبرعات المتجر اليومية", desc: "ملف تبرعات المتجر اليومي", icon: HeartHandshake, color: BRAND_GRADIENT_SOFT },
  { value: "subscriptions", label: "الاستقطاعات", desc: "ملف المستقطعين والاشتراكات الشهرية المتكررة", icon: Repeat, color: BRAND_GRADIENT },
  { value: "campaigns", label: "الحملات", desc: "ملف الحملات وأهدافها وتبرعاتها", icon: Megaphone, color: BRAND_GRADIENT_WARM },
  { value: "gifts", label: "الإهداءات", desc: "ملف التبرعات الإهدائية والمهدى إليهم", icon: Gift, color: BRAND_GRADIENT_SOFT },
  { value: "abandoned_carts", label: "السلال المتروكة", desc: "ملف السلال غير المكتملة لإعادة الاستهداف", icon: ShoppingCart, color: BRAND_GRADIENT_WARM },
  { value: "staff_duties", label: "مهام موظفي المتجر", desc: "ربط المهام بكل موظف تلقائياً", icon: Users, color: BRAND_GRADIENT },
  { value: "reports", label: "تقارير", desc: "تقارير دورية، ملفات تحليلية", icon: FileText, color: BRAND_GRADIENT_SOFT },
  { value: "profiles", label: "ملفات تعريفية", desc: "بروفايلات، تعاريف موظفين/جمعية", icon: IdCard, color: BRAND_GRADIENT },
  { value: "tasks", label: "مهام/خطط", desc: "ملفات مهام أو خطط للأرشفة", icon: ListChecks, color: BRAND_GRADIENT_WARM },
  { value: "other", label: "ملفات أخرى", desc: "أي ملف آخر للأرشفة والتحليل", icon: FolderOpen, color: BRAND_GRADIENT },
];

export default function Uploads() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [forDate, setForDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [category, setCategory] = useState<UploadCategory>("auto");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // The active organization comes from the route/selector (currentOrg) so a
  // super admin browsing another organization never sees their own org files.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (currentOrg?.id) {
        setOrgId(currentOrg.id);
        return;
      }
      if (!user) {
        setOrgId(null);
        return;
      }
      const { data } = await supabase.rpc("get_user_organization_id", { _user_id: user.id });
      if (!cancelled) setOrgId((data as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrg?.id]);


  const loadHistory = useCallback(async () => {
    if (!orgId) {
      setHistory([]);
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("data_uploads_log")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setHistory(data as HistoryRow[]);
    setLoadingHistory(false);
  }, [orgId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);


  // ===== معاينة الملفات المرفقة =====
  const [previewRow, setPreviewRow] = useState<HistoryRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const openPreview = useCallback(
    async (row: HistoryRow) => {
      setPreviewRow(row);
      setPreviewUrl(null);
      setPreviewError(null);
      setPreviewLoading(true);
      try {
        const candidates: { bucket: string; path: string }[] = [];
        if (row.file_path) {
          candidates.push({ bucket: row.storage_bucket || "data-uploads", path: row.file_path });
        } else if (row.organization_id) {
          // سجلات قديمة بلا مسار محفوظ — نبحث عنها في مجلد الأرشيف بالاسم
          const schema = row.detected_schema || "other";
          for (const bucket of ["data-uploads", "org-documents"]) {
            const { data: list } = await supabase.storage
              .from(bucket)
              .list(`${row.organization_id}/archive/${schema}`, { limit: 200 });
            const hit = (list || []).find((f) => f.name.endsWith(row.file_name));
            if (hit) {
              candidates.push({
                bucket,
                path: `${row.organization_id}/archive/${schema}/${hit.name}`,
              });
              break;
            }
          }
        }
        if (candidates.length === 0) {
          setPreviewError("هذا السجل لا يحتوي على ملف محفوظ للمعاينة (تم إدراج بياناته فقط).");
          return;
        }
        const { bucket, path } = candidates[0];
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) throw new Error(error?.message || "تعذر إنشاء رابط المعاينة");
        setPreviewUrl(data.signedUrl);
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : "تعذر فتح المعاينة");
      } finally {
        setPreviewLoading(false);
      }
    },
    [],
  );

  const closePreview = () => {
    setPreviewRow(null);
    setPreviewUrl(null);
    setPreviewError(null);
  };

  // ===== حذف الملفات المرفوعة =====
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteUpload = useCallback(
    async (row: HistoryRow) => {
      const ok = window.confirm(
        `هل تريد حذف "${row.file_name}" نهائياً من مركز الملفات؟ لا يمكن التراجع عن هذه العملية.`,
      );
      if (!ok) return;
      setDeletingId(row.id);
      try {
        if (row.file_path) {
          // حذف الملف من التخزين (تجاهل الفشل كي لا يمنع حذف السجل)
          await supabase.storage
            .from(row.storage_bucket || "data-uploads")
            .remove([row.file_path]);
        }
        const { error } = await supabase.from("data_uploads_log").delete().eq("id", row.id);
        if (error) throw error;
        setHistory((prev) => prev.filter((r) => r.id !== row.id));
        setPreviewRow((p) => (p?.id === row.id ? null : p));
        setAnalysisRow((p) => (p?.id === row.id ? null : p));
        toast.success(`تم حذف "${row.file_name}"`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر حذف الملف");
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  // ===== التحليل الذكي للملفات المؤرشفة =====
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisRow, setAnalysisRow] = useState<HistoryRow | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);

  const analyzeFile = useCallback(
    async (row: HistoryRow, silent = false) => {
      if ((row.file_size_bytes ?? 0) > MAX_AI_ANALYSIS_BYTES) {
        if (!silent) {
          toast.info("تم حفظ الملف بأمان، لكن حجمه يتجاوز حد التحليل الذكي (30MB).");
        }
        return false;
      }
      setAnalyzingId(row.id);
      try {
        const { data, error } = await supabase.functions.invoke("analyze-uploaded-file", {
          body: { upload_id: row.id },
        });
        if (error) {
          // نقرأ رسالة الوظيفة إن توفرت لتظهر بالعربية للمستخدم
          const ctx = (error as any)?.context;
          let msg = error.message;
          try {
            const j = await ctx?.json?.();
            if (j?.message || j?.error) msg = j.message || j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const analysis = (data as any)?.analysis ?? null;
        setHistory((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, ai_analysis: analysis, ai_analyzed_at: new Date().toISOString() }
              : r,
          ),
        );
        if (!silent) {
          setAnalysisRow({ ...row, ai_analysis: analysis, ai_analyzed_at: new Date().toISOString() });
          toast.success(`تم تحليل "${row.file_name}" بالذكاء الاصطناعي`);
        }
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "تعذر تحليل الملف";
        if (!silent) toast.error(msg);
        return false;
      } finally {
        setAnalyzingId(null);
      }
    },
    [],
  );

  const analyzeAllPending = useCallback(async () => {
    const pendingFiles = history.filter((r) => r.file_path && !r.ai_analysis);
    const targets = pendingFiles.filter(
      (r) => (r.file_size_bytes ?? 0) <= MAX_AI_ANALYSIS_BYTES,
    );
    if (targets.length === 0) {
      toast.info(
        pendingFiles.length > 0
          ? "الملفات المتبقية محفوظة، لكن أحجامها تتجاوز حد التحليل الذكي (30MB)."
          : "جميع الملفات المحفوظة محلَّلة بالفعل",
      );
      return;
    }
    setBulkAnalyzing(true);
    let ok = 0;
    let failed = 0;
    for (const row of targets.slice(0, 25)) {
      const done = await analyzeFile(row, true);
      done ? ok++ : failed++;
    }
    setBulkAnalyzing(false);
    toast.success(`تم تحليل ${ok} ملفاً${failed ? ` — تعذّر تحليل ${failed}` : ""}`);
  }, [history, analyzeFile]);


  const processStaffDuties = useCallback(
    async (pf: PendingFile) => {
      if (!user || !orgId) throw new Error("تعذر تحديد الجمعية");
      const path = `${orgId}/${Date.now()}_${safeStorageFileName(pf.file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("staff-duties-files")
        .upload(path, pf.file, { upsert: false });
      if (upErr) throw upErr;

      const { data: imp, error: impErr } = await supabase
        .from("staff_duties_imports")
        .insert({
          uploaded_by: user.id,
          organization_id: orgId,
          file_name: pf.file.name,
          file_path: path,
          file_size_bytes: pf.file.size,
          status: "pending",
        })
        .select()
        .single();
      if (impErr) throw impErr;

      const { data: parsed, error: fnErr } = await supabase.functions.invoke(
        "parse-staff-duties-xlsx",
        { body: { import_id: imp.id } },
      );
      if (fnErr) throw fnErr;

      await supabase.from("data_uploads_log").insert({
        uploaded_by: user.id,
        organization_id: orgId,
        file_name: pf.file.name,
        file_type: pf.file.type || "application/vnd.ms-excel",
        detected_schema: "staff_duties",
        file_path: path,
        storage_bucket: "staff-duties-files",
        total_rows: parsed?.total ?? 0,
        inserted_rows: parsed?.imported ?? 0,
        duplicate_rows: 0,
        failed_rows: parsed?.unmatched ?? 0,
        for_date: forDate || null,
        status: "completed",
        completed_at: new Date().toISOString(),
      });

      return {
        detected: "staff_duties",
        inserted: parsed?.imported ?? 0,
        duplicates: 0,
        failed: parsed?.unmatched ?? 0,
        matched: parsed?.matched ?? 0,
      };
    },
    [user, orgId, forDate],
  );

  const archiveFile = useCallback(
    async (pf: PendingFile, schemaTag: string) => {
      if (!user || !orgId) throw new Error("تعذر تحديد الجمعية");
      const path = `${orgId}/archive/${schemaTag}/${Date.now()}_${safeStorageFileName(pf.file.name)}`;
      // org-documents accepts all file types (data-uploads is restricted to Excel/CSV)
      const { error: upErr } = await supabase.storage
        .from("org-documents")
        .upload(path, pf.file, { upsert: false });
      if (upErr) throw upErr;

      const { error: logErr } = await supabase.from("data_uploads_log").insert({
        uploaded_by: user.id,
        organization_id: orgId,
        file_name: pf.file.name,
        file_type: pf.file.type || "application/octet-stream",
        detected_schema: schemaTag,
        file_path: path,
        storage_bucket: "org-documents",
        total_rows: 0,
        inserted_rows: 1,
        duplicate_rows: 0,
        failed_rows: 0,
        for_date: forDate || null,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      if (logErr) {
        await supabase.storage.from("org-documents").remove([path]);
        throw logErr;
      }

      return { detected: schemaTag, inserted: 1, duplicates: 0, failed: 0 };
    },
    [user, orgId, forDate],
  );

  const processFile = useCallback(
    async (pf: PendingFile) => {
      setPending((prev) =>
        prev.map((p) => (p.id === pf.id ? { ...p, status: "uploading", progress: 30 } : p)),
      );
      try {
        let result: PendingFile["result"];

        if (pf.category === "staff_duties") {
          result = await processStaffDuties(pf);
        } else if (
          pf.category === "auto" &&
          !/\.(xlsx|xls|csv)$/i.test(pf.file.name)
        ) {
          // البيانات العامة تقبل المستندات والصور أيضاً؛ الجداول فقط تمر عبر محلل البيانات.
          result = await archiveFile(pf, "profiles");
        } else if (
          pf.category === "reports" ||
          pf.category === "profiles" ||
          pf.category === "tasks" ||
          pf.category === "other"
        ) {
          result = await archiveFile(pf, pf.category);
        } else {
          // auto / store_master / store_daily / subscriptions / campaigns / gifts / abandoned_carts
          // تمر جميعها عبر معالج البيانات الذكي ليتولى الكشف والإدراج في الجدول المناسب.
          const formData = new FormData();
          formData.append("file", pf.file);
          if (forDate) formData.append("for_date", forDate);
          formData.append("target_organization_id", orgId);
          if (pf.category === "store_master") formData.append("source_kind", "store_master");
          if (pf.category === "store_daily") formData.append("source_kind", "store_daily");
          if (
            pf.category === "subscriptions" ||
            pf.category === "campaigns" ||
            pf.category === "gifts" ||
            pf.category === "abandoned_carts"
          ) {
            formData.append("source_kind", pf.category);
          }
          // ملفات Excel الكبيرة قد تتجاوز ذاكرة محلل الجداول. نحفظ الأصل أولاً
          // في مركز الملفات بدلاً من خسارة الرفع، ويمكن تحليله لاحقاً على دفعات.
          if (pf.file.size > 8 * 1024 * 1024) {
            result = {
              ...(await archiveFile(pf, pf.category === "auto" ? "profiles" : pf.category)),
              archivedOnly: true,
            };
          } else {
            const { data, error } = await supabase.functions.invoke("process-upload", {
              body: formData,
            });
            if (error) {
              // إذا تعطلت المعالجة (مثل نفاد الذاكرة)، لا نفشل رفع المستخدم:
              // نحتفظ بالملف الأصلي معزولاً داخل جمعية المستخدم.
              console.warn("Excel processing failed; archiving original file", error);
              result = {
                ...(await archiveFile(pf, pf.category === "auto" ? "profiles" : pf.category)),
                archivedOnly: true,
              };
            } else {
              result = {
                detected: data.detected,
                inserted: data.inserted ?? 0,
                duplicates: data.duplicates ?? 0,
                failed: data.failed ?? 0,
              };
            }
          }
        }

        setPending((prev) =>
          prev.map((p) =>
            p.id === pf.id ? { ...p, status: "success", progress: 100, result } : p,
          ),
        );
        toast.success(
          result?.archivedOnly
            ? `تم رفع "${pf.file.name}" وحفظه بأمان في مركز الملفات. حجمه كبير، لذلك لم تُستورد صفوفه تلقائياً.`
            : `تم رفع "${pf.file.name}" — ${result?.inserted ?? 0} سجل. يجري ربط الملف بالتحليل الذكي والتوصيات والمساءلات…`,
          { duration: 6000 },
        );
        // 🧠 Trigger daily intelligence engine after data uploads
        if (
          pf.category !== "staff_duties" &&
          pf.category !== "profiles" &&
          pf.category !== "tasks" &&
          pf.category !== "reports" &&
          pf.category !== "other" &&
          !result?.archivedOnly
        ) {
          (async () => {
            try {
              const { data: u } = await supabase.auth.getUser();
              if (!orgId) return;
              const { data: intelData } = await supabase.functions.invoke(
                "daily-donor-intelligence",
                {
                  body: {
                    organizationId: orgId,
                    trigger: "upload",
                    dataset: pf.category,
                    caller_user_id: u.user?.id,
                  },
                },
              );
              const stats = (intelData as any)?.stats;
              if (stats) {
                toast.success(
                  `🧠 العقل اليومي: ${stats.insights_saved || 0} رؤية و ${stats.tasks_saved || 0} مهمة جديدة على الموظفين`,
                  { duration: 7000 },
                );
              }
            } catch (intelErr) {
              console.warn("daily-donor-intelligence trigger failed", intelErr);
            }
          })();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "فشل الرفع";
        setPending((prev) =>
          prev.map((p) => (p.id === pf.id ? { ...p, status: "error", progress: 100, error: msg } : p)),
        );
        toast.error(`فشل رفع "${pf.file.name}": ${msg}`);
      } finally {
        loadHistory();
      }
    },
    [forDate, loadHistory, processStaffDuties, archiveFile, orgId],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const isDataCategory =
        category === "store_master" ||
        category === "store_daily" ||
        category === "subscriptions" ||
        category === "campaigns" ||
        category === "gifts" ||
        category === "abandoned_carts" ||
        category === "staff_duties";
      const arr = Array.from(files).filter((f) => {
        if (isDataCategory) return /\.(xlsx|xls|csv)$/i.test(f.name);
        return f.size <= 50 * 1024 * 1024;
      });
      if (arr.length === 0) {
        toast.error(
          isDataCategory
            ? "الرجاء اختيار ملفات Excel أو CSV فقط"
            : "تعذر قبول الملفات (الحد الأقصى 50MB)",
        );
        return;
      }
      const newPending: PendingFile[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "queued",
        progress: 0,
        category,
      }));
      setPending((prev) => [...prev, ...newPending]);
      (async () => {
        for (const pf of newPending) {
          await processFile(pf);
        }
      })();
    },
    [processFile, category],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const clearCompleted = () => {
    setPending((prev) => prev.filter((p) => p.status !== "success"));
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">يجب تسجيل الدخول</p>
        </div>
      </DashboardLayout>
    );
  }

  const activeCat = CATEGORY_OPTIONS.find((c) => c.value === category)!;
  const ActiveIcon = activeCat.icon;
  const isDataCategory =
    category === "store_master" ||
    category === "store_daily" ||
    category === "staff_duties";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          icon={<Upload className="w-6 h-6" />}
          title="رفع الملفات"
          subtitle="مكان موحّد لرفع جميع ملفات الجمعية — اختر الفئة وسيقوم النظام بالقراءة، الربط، والتحليل تلقائياً"
        />
        <PageGuide
          description="هذه الصفحة هي البوابة الموحّدة لرفع جميع ملفات الجمعية إلى النظام (مستندات Word، جداول Excel، ملفات PDF، صور). يقوم النظام بقراءة الملف تلقائياً، استخراج البيانات منه، وربطه بالقسم الصحيح (موظفون، خطط، مهام، تقارير) ثم تحليل محتواه بالذكاء الاصطناعي لاستخراج ملخّص ومؤشرات."
          features={[
            "اختيار فئة الملف لتوجيهه للقسم المناسب",
            "قراءة محتوى Excel وWord وPDF آلياً",
            "ربط البيانات بسجلات الموظفين والخطط",
            "تحليل ذكي للمحتوى واستخراج ملخّص",
            "حفظ المرفقات والرجوع إليها لاحقاً",
          ]}
        />

        {/* Category selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="w-5 h-5 text-primary" />
              نوع الملف
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CATEGORY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "text-right rounded-xl border-2 p-3 transition-all",
                      active
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2 shadow",
                        opt.color,
                      )}
                    >
                      <Icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Date selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="for_date" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تاريخ البيانات (اليوم الذي تخصّه الملفات)
                </Label>
                <Input
                  id="for_date"
                  type="date"
                  value={forDate}
                  onChange={(e) => setForDate(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground pb-2">
                سيتم ربط جميع الملفات المرفوعة بهذا التاريخ.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dropzone — مع توهج خفيف عند السحب */}
        <Card className="overflow-hidden">
          <CardContent
            className={cn(
              "relative p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all",
              "bg-gradient-to-br from-[hsl(var(--accent)/0.04)] via-transparent to-[hsl(var(--primary)/0.04)]",
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01] shadow-[0_0_40px_-10px_hsl(var(--accent)/0.5)]"
                : "border-border hover:border-primary/50 hover:bg-primary/[0.02]",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={isDataCategory ? ".xlsx,.xls,.csv" : undefined}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <div className="flex flex-col items-center gap-4">
              <div className={cn("w-20 h-20 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg", activeCat.color)}>
                <ActiveIcon className="w-10 h-10 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xl font-semibold">
                  اسحب ملفات <span className="text-primary">{activeCat.label}</span> هنا
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isDataCategory
                    ? "أو انقر للاختيار — يدعم XLSX, XLS, CSV (حتى 50MB)"
                    : "أو انقر للاختيار — يقبل أي صيغة (PDF, Word, Excel, صور…) حتى 50MB"}
                </p>
              </div>
              <Button variant="outline" type="button">
                <FileSpreadsheet className="w-4 h-4 ml-2" />
                اختر ملفات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending uploads */}
        {pending.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>الملفات الحالية ({pending.length})</CardTitle>
              {pending.some((p) => p.status === "success") && (
                <Button variant="ghost" size="sm" onClick={clearCompleted}>
                  مسح المكتملة
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {pending.map((p) => {
                const schema = p.result?.detected
                  ? SCHEMA_LABELS[p.result.detected] ?? SCHEMA_LABELS.unknown
                  : null;
                return (
                  <div key={p.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(p.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {p.status === "queued" && (
                        <Badge variant="secondary">في الانتظار</Badge>
                      )}
                      {p.status === "uploading" && (
                        <Badge className="bg-accent text-accent-foreground">
                          <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                          جاري المعالجة
                        </Badge>
                      )}
                      {p.status === "success" && schema && (
                        <Badge className={schema.color}>
                          <CheckCircle2 className="w-3 h-3 ml-1" />
                          {schema.label}
                        </Badge>
                      )}
                      {p.status === "error" && (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 ml-1" />
                          فشل
                        </Badge>
                      )}
                    </div>
                    {(p.status === "uploading" || p.status === "queued") && (
                      <Progress value={p.progress} className="h-2" />
                    )}
                    {p.status === "success" && p.result && (
                      <div className="flex gap-4 text-sm pt-1 mr-8 flex-wrap">
                        <span className="text-primary font-medium">
                          ✓ مُدخل: {p.result.inserted}
                        </span>
                        {p.result.matched !== undefined && p.result.matched > 0 && (
                          <span className="text-accent">
                            👤 موظف مرتبط: {p.result.matched}
                          </span>
                        )}
                        {p.result.duplicates > 0 && (
                          <span className="text-warning">
                            ⚠ مكرر: {p.result.duplicates}
                          </span>
                        )}
                        {p.result.failed > 0 && (
                          <span className="text-destructive">
                            ✗ فشل: {p.result.failed}
                          </span>
                        )}
                      </div>
                    )}
                    {p.status === "error" && p.error && (
                      <div className="flex items-start gap-2 text-sm text-destructive mr-8">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{p.error}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* معاينة الملف المختار */}
        {previewRow && (
          <Card className="border-primary/40 shadow-lg">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-5 h-5 text-primary" />
                  <span className="truncate">{previewRow.file_name}</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {(previewRow.detected_schema
                    ? SCHEMA_LABELS[previewRow.detected_schema] ?? SCHEMA_LABELS.unknown
                    : SCHEMA_LABELS.unknown).label}
                  {" · "}
                  {new Date(previewRow.created_at).toLocaleString("ar-SA")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewUrl && (
                  <>
                    <Button asChild variant="outline" size="sm" className="gap-1">
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        فتح
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1">
                      <a href={previewUrl} download={previewRow.file_name}>
                        <Download className="w-4 h-4" />
                        تنزيل
                      </a>
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={closePreview} aria-label="إغلاق المعاينة">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : previewError ? (
                <div className="flex items-start gap-2 text-sm text-destructive py-6">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{previewError}</span>
                </div>
              ) : previewUrl ? (
                (() => {
                  const name = previewRow.file_name.toLowerCase();
                  const type = (previewRow.file_type || "").toLowerCase();
                  const isImg = type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(name);
                  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
                  const isOffice = /\.(docx?|xlsx?|pptx?|csv)$/.test(name);
                  if (isImg) {
                    return (
                      <div className="flex justify-center bg-muted/30 rounded-lg p-4">
                        <img
                          src={previewUrl}
                          alt={previewRow.file_name}
                          className="max-h-[65vh] rounded-lg object-contain"
                        />
                      </div>
                    );
                  }
                  if (isPdf) {
                    return <SmartPdfViewer fileUrl={previewUrl} fileName={previewRow.file_name} />;
                  }
                  if (isOffice) {
                    return (
                      <iframe
                        title={previewRow.file_name}
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                        className="w-full h-[65vh] rounded-lg border border-border bg-muted/20"
                      />
                    );
                  }
                  return (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      لا تتوفر معاينة مباشرة لهذه الصيغة — استخدم زر التنزيل لعرض الملف.
                    </div>
                  );
                })()
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* نتيجة التحليل الذكي */}
        {analysisRow && (
          <Card className="border-accent/50 shadow-lg">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span className="truncate">تحليل ذكي — {analysisRow.file_name}</span>
                </CardTitle>
                {analysisRow.ai_analyzed_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(analysisRow.ai_analyzed_at).toLocaleString("ar-SA")}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setAnalysisRow(null)} aria-label="إغلاق التحليل">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {analysisRow.ai_analysis?.document_type && (
                <Badge className="bg-accent text-accent-foreground">
                  {analysisRow.ai_analysis.document_type}
                </Badge>
              )}
              {analysisRow.ai_analysis?.summary && (
                <p className="leading-relaxed text-foreground">{analysisRow.ai_analysis.summary}</p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["أبرز النقاط", "key_points"],
                    ["أرقام ومؤشرات", "numbers"],
                    ["نقاط القوة", "strengths"],
                    ["فجوات ومخاطر", "gaps"],
                    ["توصيات عملية", "recommendations"],
                    ["مهام مقترحة", "suggested_tasks"],
                  ] as const
                ).map(([label, key]) => {
                  const items = analysisRow.ai_analysis?.[key];
                  if (!Array.isArray(items) || items.length === 0) return null;
                  return (
                    <div key={key} className="rounded-lg border border-border p-3 bg-muted/20">
                      <p className="font-bold mb-2 text-foreground">{label}</p>
                      <ul className="space-y-1 list-disc pe-4 text-muted-foreground">
                        {items.map((it: unknown, i: number) => (
                          <li key={i}>{String(it)}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              سجل الرفع
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={analyzeAllPending}
              disabled={bulkAnalyzing}
            >
              {bulkAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              تحليل الملفات غير المحلَّلة
            </Button>
          </CardHeader>

          <CardContent>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد عمليات رفع سابقة
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الملف</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">تاريخ البيانات</TableHead>
                    <TableHead className="text-right">المُدخل</TableHead>
                    <TableHead className="text-right">المكرر</TableHead>
                    <TableHead className="text-right">الفاشل</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الرفع</TableHead>
                    <TableHead className="text-right">معاينة</TableHead>
                    <TableHead className="text-right">تحليل ذكي</TableHead>
                    <TableHead className="text-right">حذف</TableHead>
                  </TableRow>

                </TableHeader>
                <TableBody>
                  {history.map((row) => {
                    const schema = row.detected_schema
                      ? SCHEMA_LABELS[row.detected_schema] ?? SCHEMA_LABELS.unknown
                      : SCHEMA_LABELS.unknown;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-xs truncate font-medium">
                          {row.file_name}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(schema.color, "text-white")}>
                            {schema.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.for_date ?? "—"}</TableCell>
                        <TableCell className="text-primary font-medium">
                          {row.inserted_rows}
                        </TableCell>
                        <TableCell className="text-warning">
                          {row.duplicate_rows}
                        </TableCell>
                        <TableCell className="text-destructive">
                          {row.failed_rows}
                        </TableCell>
                        <TableCell>
                          {row.status === "completed" && (
                            <Badge className="bg-primary text-primary-foreground">مكتمل</Badge>
                          )}
                          {row.status === "completed_with_errors" && (
                            <Badge className="bg-warning text-warning-foreground">مكتمل مع أخطاء</Badge>
                          )}
                          {row.status === "failed" && (
                            <Badge variant="destructive">فشل</Badge>
                          )}
                          {row.status === "processing" && (
                            <Badge variant="secondary">جاري المعالجة</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("ar-SA")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-primary"
                            onClick={() => openPreview(row)}
                          >
                            <Eye className="w-4 h-4" />
                            معاينة
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-accent"
                              disabled={
                                analyzingId === row.id ||
                                bulkAnalyzing ||
                                !row.file_path ||
                                (row.file_size_bytes ?? 0) > MAX_AI_ANALYSIS_BYTES
                              }
                              onClick={() => analyzeFile(row)}
                            >
                              {analyzingId === row.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              {(row.file_size_bytes ?? 0) > MAX_AI_ANALYSIS_BYTES
                                ? "أكبر من 30MB"
                                : row.ai_analysis
                                  ? "إعادة التحليل"
                                  : "تحليل"}
                            </Button>
                            {row.ai_analysis && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary"
                                onClick={() => setAnalysisRow(row)}
                              >
                                عرض
                              </Button>
                            )}
                          </div>
                         </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => deleteUpload(row)}
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            حذف
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
