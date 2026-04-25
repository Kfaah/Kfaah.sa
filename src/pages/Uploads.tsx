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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type UploadStatus = "queued" | "uploading" | "success" | "error";

interface PendingFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  result?: {
    detected: string;
    inserted: number;
    duplicates: number;
    failed: number;
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

const SCHEMA_LABELS: Record<string, { label: string; color: string }> = {
  donations: { label: "تبرعات", color: "bg-emerald-500" },
  failed_donations: { label: "تبرعات فاشلة", color: "bg-red-500" },
  bank_transfers: { label: "تحويلات بنكية", color: "bg-blue-500" },
  abandoned_carts: { label: "سلال متروكة", color: "bg-orange-500" },
  campaigns: { label: "حملات", color: "bg-purple-500" },
  subscriptions: { label: "استقطاعات/اشتراكات", color: "bg-cyan-500" },
  gifts: { label: "إهداءات", color: "bg-pink-500" },
  unknown: { label: "غير معروف", color: "bg-slate-500" },
};

export default function Uploads() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [forDate, setForDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

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

  const processFile = useCallback(
    async (pf: PendingFile) => {
      setPending((prev) =>
        prev.map((p) => (p.id === pf.id ? { ...p, status: "uploading", progress: 30 } : p)),
      );
      try {
        const formData = new FormData();
        formData.append("file", pf.file);
        if (forDate) formData.append("for_date", forDate);

        const { data, error } = await supabase.functions.invoke("process-upload", {
          body: formData,
        });

        if (error) throw error;

        setPending((prev) =>
          prev.map((p) =>
            p.id === pf.id
              ? {
                  ...p,
                  status: "success",
                  progress: 100,
                  result: {
                    detected: data.detected,
                    inserted: data.inserted ?? 0,
                    duplicates: data.duplicates ?? 0,
                    failed: data.failed ?? 0,
                  },
                }
              : p,
          ),
        );
        toast.success(
          `تم رفع "${pf.file.name}" — ${data.inserted ?? 0} سجل. يجري الآن تحليل البيانات وربطها بالنظرة العامة، التحليل الذكي، التوصيات، المقارنة، والابتكار…`,
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
    [forDate, loadHistory],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) =>
        /\.(xlsx|xls|csv)$/i.test(f.name),
      );
      if (arr.length === 0) {
        toast.error("الرجاء اختيار ملفات Excel أو CSV فقط");
        return;
      }
      const newPending: PendingFile[] = arr.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "queued",
        progress: 0,
      }));
      setPending((prev) => [...prev, ...newPending]);
      // Process sequentially to avoid hammering the function
      (async () => {
        for (const pf of newPending) {
          await processFile(pf);
        }
      })();
    },
    [processFile],
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg">
                <Upload className="w-6 h-6 text-white" />
              </div>
              رفع البيانات
            </h1>
            <p className="text-muted-foreground mt-2">
              ارفع ملفات Excel/CSV — سيتم اكتشاف نوع الملف تلقائيًا (تبرعات، سلال، حملات، استقطاعات، إهداءات، تحويلات)
            </p>
          </div>
        </div>

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

        {/* Dropzone */}
        <Card>
          <CardContent
            className={cn(
              "p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all",
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50",
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
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center">
                <Upload className="w-10 h-10 text-rose-500" />
              </div>
              <div>
                <p className="text-xl font-semibold">اسحب الملفات هنا</p>
                <p className="text-sm text-muted-foreground mt-1">
                  أو انقر للاختيار — يدعم XLSX, XLS, CSV (حتى 50MB)
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
                        <Badge className="bg-blue-500">
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
                      <div className="flex gap-4 text-sm pt-1 mr-8">
                        <span className="text-emerald-600 font-medium">
                          ✓ مُدخل: {p.result.inserted}
                        </span>
                        {p.result.duplicates > 0 && (
                          <span className="text-amber-600">
                            ⚠ مكرر: {p.result.duplicates}
                          </span>
                        )}
                        {p.result.failed > 0 && (
                          <span className="text-red-600">
                            ✗ فشل: {p.result.failed}
                          </span>
                        )}
                      </div>
                    )}
                    {p.status === "error" && p.error && (
                      <div className="flex items-start gap-2 text-sm text-red-600 mr-8">
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
                        <TableCell className="text-emerald-600 font-medium">
                          {row.inserted_rows}
                        </TableCell>
                        <TableCell className="text-amber-600">
                          {row.duplicate_rows}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {row.failed_rows}
                        </TableCell>
                        <TableCell>
                          {row.status === "completed" && (
                            <Badge className="bg-emerald-500">مكتمل</Badge>
                          )}
                          {row.status === "completed_with_errors" && (
                            <Badge className="bg-amber-500">مكتمل مع أخطاء</Badge>
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
