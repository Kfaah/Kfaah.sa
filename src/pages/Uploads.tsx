import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UploadStatus = "queued" | "uploading" | "success" | "error";

type UploadCategory =
  | "auto"
  | "store_master"
  | "store_daily"
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
}

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
  { value: "staff_duties", label: "مهام موظفي المتجر", desc: "ربط المهام بكل موظف تلقائياً", icon: Users, color: BRAND_GRADIENT },
  { value: "reports", label: "تقارير", desc: "تقارير دورية، ملفات تحليلية", icon: FileText, color: BRAND_GRADIENT_SOFT },
  { value: "profiles", label: "ملفات تعريفية", desc: "بروفايلات، تعاريف موظفين/جمعية", icon: IdCard, color: BRAND_GRADIENT },
  { value: "tasks", label: "مهام/خطط", desc: "ملفات مهام أو خطط للأرشفة", icon: ListChecks, color: BRAND_GRADIENT_WARM },
  { value: "other", label: "ملفات أخرى", desc: "أي ملف آخر للأرشفة والتحليل", icon: FolderOpen, color: BRAND_GRADIENT },
];

export default function Uploads() {
  const { user } = useAuth();
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

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.rpc("get_user_organization_id", { _user_id: user.id });
      setOrgId((data as string | null) ?? null);
    })();
  }, [user]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("data_uploads_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) setHistory(data as HistoryRow[]);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const processStaffDuties = useCallback(
    async (pf: PendingFile) => {
      if (!user || !orgId) throw new Error("تعذر تحديد الجمعية");
      const path = `${orgId}/${Date.now()}_${pf.file.name}`;
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
      const path = `${orgId}/archive/${schemaTag}/${Date.now()}_${pf.file.name}`;
      const { error: upErr } = await supabase.storage
        .from("data-uploads")
        .upload(path, pf.file, { upsert: false });
      if (upErr) throw upErr;

      await supabase.from("data_uploads_log").insert({
        uploaded_by: user.id,
        organization_id: orgId,
        file_name: pf.file.name,
        file_type: pf.file.type || "application/octet-stream",
        detected_schema: schemaTag,
        total_rows: 0,
        inserted_rows: 1,
        duplicate_rows: 0,
        failed_rows: 0,
        for_date: forDate || null,
        status: "completed",
        completed_at: new Date().toISOString(),
      });

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
          pf.category === "reports" ||
          pf.category === "profiles" ||
          pf.category === "tasks" ||
          pf.category === "other"
        ) {
          result = await archiveFile(pf, pf.category);
        } else {
          // auto / store_master / store_daily — تمر عبر معالج البيانات الذكي
          const formData = new FormData();
          formData.append("file", pf.file);
          if (forDate) formData.append("for_date", forDate);
          if (pf.category === "store_master") formData.append("source_kind", "store_master");
          if (pf.category === "store_daily") formData.append("source_kind", "store_daily");
          const { data, error } = await supabase.functions.invoke("process-upload", {
            body: formData,
          });
          if (error) throw error;
          result = {
            detected: data.detected,
            inserted: data.inserted ?? 0,
            duplicates: data.duplicates ?? 0,
            failed: data.failed ?? 0,
          };
        }

        setPending((prev) =>
          prev.map((p) =>
            p.id === pf.id ? { ...p, status: "success", progress: 100, result } : p,
          ),
        );
        toast.success(
          `تم رفع "${pf.file.name}" — ${result?.inserted ?? 0} سجل. يجري ربط الملف بالتحليل الذكي والتوصيات والمساءلات…`,
          { duration: 6000 },
        );
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
    [forDate, loadHistory, processStaffDuties, archiveFile],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const isDataCategory =
        category === "auto" ||
        category === "store_master" ||
        category === "store_daily" ||
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
    category === "auto" ||
    category === "store_master" ||
    category === "store_daily" ||
    category === "staff_duties";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header — بانر زخرفي هادئ بهوية الجمعية */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-l from-[hsl(var(--primary))] via-[hsl(var(--primary))] to-[hsl(var(--accent))] p-6 shadow-lg">
          {/* دوائر زخرفية ناعمة */}
          <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 right-1/4 h-48 w-48 rounded-full bg-[hsl(38_85%_55%)]/20 blur-3xl" />
          <div className="pointer-events-none absolute top-4 left-1/3 h-2 w-2 rounded-full bg-white/40" />
          <div className="pointer-events-none absolute bottom-6 left-1/4 h-1.5 w-1.5 rounded-full bg-white/30" />

          <div className="relative flex items-center justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                رفع الملفات
              </h1>
              <p className="text-white/85 mt-2 max-w-3xl text-sm leading-relaxed">
                مكان موحّد لرفع جميع ملفات الجمعية — اختر الفئة وسيقوم النظام بالقراءة، الربط، والتحليل تلقائياً (تبرعات المتجر، مهام الموظفين، تقارير، ملفات تعريفية…)
              </p>
            </div>
            {/* أيقونة زخرفية كبيرة على اليسار */}
            <div className="hidden md:flex shrink-0 w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 items-center justify-center">
              <FolderOpen className="w-10 h-10 text-white/80" strokeWidth={1.5} />
            </div>
          </div>
        </div>

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
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
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

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              سجل الرفع
            </CardTitle>
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
