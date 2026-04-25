import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Users,
  ListChecks,
  Sparkles,
  Info,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ImportRow {
  id: string;
  file_name: string;
  status: string;
  total_rows: number;
  imported_duties: number;
  matched_employees: number;
  unmatched_rows: number;
  sheet_summary: Record<string, number> | null;
  error_log: any;
  created_at: string;
  completed_at: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "في الانتظار", cls: "bg-slate-100 text-slate-700" },
  processing: { label: "قيد المعالجة", cls: "bg-amber-100 text-amber-700" },
  success: { label: "ناجح", cls: "bg-emerald-100 text-emerald-700" },
  partial: { label: "جزئي", cls: "bg-orange-100 text-orange-700" },
  failed: { label: "فشل", cls: "bg-rose-100 text-rose-700" },
};

export default function StaffDutiesUpload() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: emp } = await supabase
        .from("employees")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setOrgId(emp?.organization_id ?? null);
      await loadImports();
    })();
  }, [user]);

  const loadImports = async () => {
    const { data } = await supabase
      .from("staff_duties_imports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setImports((data as any) ?? []);
  };

  const handleFile = async (file: File) => {
    if (!user || !orgId) {
      toast.error("تعذر تحديد الجمعية");
      return;
    }
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("الملف يجب أن يكون Excel (.xlsx)");
      return;
    }
    setUploading(true);
    setProgress(15);
    try {
      const path = `${orgId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("staff-duties-files")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      setProgress(45);

      const { data: imp, error: impErr } = await supabase
        .from("staff_duties_imports")
        .insert({
          uploaded_by: user.id,
          organization_id: orgId,
          file_name: file.name,
          file_path: path,
          file_size_bytes: file.size,
          status: "pending",
        })
        .select()
        .single();
      if (impErr) throw impErr;
      setProgress(60);

      const { data: parsed, error: fnErr } = await supabase.functions.invoke(
        "parse-staff-duties-xlsx",
        { body: { import_id: imp.id } },
      );
      if (fnErr) throw fnErr;
      setProgress(100);

      toast.success(
        `تم استيراد ${parsed?.imported ?? 0} مهمة وربطها بـ ${parsed?.matched ?? 0} موظف`,
      );
      await loadImports();
    } catch (e: any) {
      toast.error(e.message ?? "تعذر رفع الملف");
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1500);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const reprocess = async (id: string) => {
    toast.info("جاري إعادة المعالجة...");
    const { data, error } = await supabase.functions.invoke("parse-staff-duties-xlsx", {
      body: { import_id: id },
    });
    if (error) toast.error(error.message);
    else toast.success(`تمت المعالجة: ${data?.imported ?? 0} مهمة`);
    await loadImports();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-5xl mx-auto" dir="rtl">
        {/* Hero */}
        <Card className="overflow-hidden border-0 shadow-xl">
          <div className="bg-gradient-to-l from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  مهام موظفي المتجر <Sparkles className="w-5 h-5" />
                </h1>
                <p className="text-white/90 text-sm mt-1">
                  ارفع ملف Excel الضخم الخاص بمهام الموظفين، وسيقوم النظام بقراءته وربطه بكل موظف وبيانات المتبرعين والإنجازات لتوليد المساءلات والمهام تلقائياً.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              رفع ملف جديد
            </CardTitle>
            <CardDescription>
              يدعم النظام الأعمدة: اسم الموظف، المهمة، الوصف، التصنيف، التكرار، الأولوية، الوقت المقدّر — بالعربية أو الإنجليزية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="border-2 border-dashed border-primary/30 rounded-xl p-10 text-center cursor-pointer hover:bg-primary/5 transition"
            >
              <FileSpreadsheet className="w-12 h-12 text-primary mx-auto mb-3" />
              <p className="font-semibold">اسحب الملف هنا أو اضغط للاختيار</p>
              <p className="text-xs text-muted-foreground mt-1">
                يدعم .xlsx و.xls — حتى 20MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            {uploading && (
              <div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> جاري الرفع والمعالجة...
                </p>
              </div>
            )}

            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle>كيف يعمل الربط؟</AlertTitle>
              <AlertDescription className="text-sm">
                يطابق النظام كل صف بموظف الجمعية عبر (الاسم/البريد/الجوال/اسم المستخدم). المهام
                المستوردة تظهر في حساب كل موظف ضمن "مهامي الوظيفية" وتدخل في توليد الخطط التنفيذية،
                المهام اليومية، والمساءلات.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              سجل عمليات الرفع
            </CardTitle>
          </CardHeader>
          <CardContent>
            {imports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                لا توجد عمليات رفع بعد
              </p>
            ) : (
              <div className="space-y-3">
                {imports.map((imp) => {
                  const status = STATUS_LABEL[imp.status] ?? STATUS_LABEL.pending;
                  const Icon =
                    imp.status === "success"
                      ? CheckCircle2
                      : imp.status === "failed"
                        ? AlertTriangle
                        : imp.status === "processing"
                          ? Loader2
                          : FileSpreadsheet;
                  return (
                    <div key={imp.id} className="border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Icon className={`w-5 h-5 ${imp.status === "processing" ? "animate-spin" : ""}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{imp.file_name}</p>
                            <p className="text-xs text-muted-foreground" style={{ fontFamily: "Arial" }}>
                              {formatDate(imp.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={status.cls}>{status.label}</Badge>
                          <Badge variant="outline" className="gap-1">
                            <ListChecks className="w-3 h-3" /> {imp.imported_duties} مهمة
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" /> {imp.matched_employees} موظف
                          </Badge>
                          {imp.unmatched_rows > 0 && (
                            <Badge variant="outline" className="text-amber-700 gap-1">
                              <AlertTriangle className="w-3 h-3" /> {imp.unmatched_rows} غير مرتبط
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reprocess(imp.id)}
                            disabled={imp.status === "processing"}
                          >
                            <RefreshCw className="w-4 h-4 ml-1" />
                            إعادة المعالجة
                          </Button>
                        </div>
                      </div>
                      {imp.sheet_summary && Object.keys(imp.sheet_summary).length > 0 && (
                        <div className="mt-3 pt-3 border-t flex flex-wrap gap-2 text-xs">
                          {Object.entries(imp.sheet_summary).map(([s, n]) => (
                            <span key={s} className="px-2 py-1 bg-muted rounded">
                              {s}: <strong>{n}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}