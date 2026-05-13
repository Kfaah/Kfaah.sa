import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ArrowRight,
  PlayCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  HardDrive,
  Clock,
  Github,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type BackupLog = {
  id: string;
  status: "running" | "success" | "failed";
  trigger_type: "manual" | "scheduled";
  tables_count: number;
  total_rows: number;
  file_size_bytes: number;
  github_path: string | null;
  github_commit_url: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 ب";
  const units = ["ب", "ك.ب", "م.ب", "غ.ب"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n.toFixed(n < 10 ? 2 : 1)} ${units[u]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function BackupSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("backup_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (!error && data) setLogs(data as BackupLog[]);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const runManualBackup = async () => {
    if (running) return;
    setRunning(true);
    toast.info("جاري بدء النسخ الاحتياطي...");
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-github", {
        body: { trigger: "manual", user_id: user?.id ?? null },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`تم النسخ الاحتياطي بنجاح! (${data.tables} جدول، ${data.rows} صف)`);
      } else {
        toast.error(`فشل النسخ: ${data?.error ?? "خطأ غير معروف"}`);
      }
    } catch (e: any) {
      toast.error(`فشل النسخ: ${e?.message ?? e}`);
    } finally {
      setRunning(false);
      loadLogs();
    }
  };

  const base = slug ? `/${slug}/settings` : "/settings";
  const lastSuccess = logs.find((l) => l.status === "success");
  const totalSize = logs
    .filter((l) => l.status === "success")
    .reduce((acc, l) => acc + (l.file_size_bytes || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<ShieldCheck className="w-6 h-6" />}
            title="النسخ الاحتياطي"
            subtitle="نسخ يومية تلقائية لقاعدة البيانات إلى GitHub"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة للإعدادات
            </Link>
          </Button>
        </div>

        {/* بطاقات الإحصاءات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">آخر نسخة ناجحة</div>
                <div className="font-bold text-base">
                  {lastSuccess ? formatDate(lastSuccess.completed_at) : "لم يتم بعد"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">عدد النسخ المحفوظة</div>
                <div className="font-bold text-base">
                  {logs.filter((l) => l.status === "success").length} نسخة
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">الحجم الإجمالي</div>
                <div className="font-bold text-base">{formatBytes(totalSize)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* بطاقة الإجراءات */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  مستودع النسخ الاحتياطية
                </h3>
                <p className="text-sm text-muted-foreground">
                  يتم رفع نسخة كاملة تلقائياً كل يوم، ويمكنك تشغيل نسخة يدوية الآن.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  asChild
                >
                  <a
                    href="https://github.com/gaberalhrese-cloud/kfaah-database-backups"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 ml-2" />
                    فتح المستودع على GitHub
                  </a>
                </Button>
                <Button onClick={runManualBackup} disabled={running}>
                  {running ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 ml-2" />
                  )}
                  {running ? "جاري التنفيذ..." : "نسخ احتياطي الآن"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* جدول السجلات */}
        <Card>
          <CardContent className="p-0">
            <div className="p-5 border-b">
              <h3 className="font-bold text-lg">آخر 50 عملية نسخ احتياطي</h3>
            </div>
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
                جاري التحميل...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                لم يتم تنفيذ أي نسخ احتياطي بعد. اضغط "نسخ احتياطي الآن" للبدء.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-right">
                      <th className="p-3 font-semibold">الحالة</th>
                      <th className="p-3 font-semibold">التاريخ</th>
                      <th className="p-3 font-semibold">النوع</th>
                      <th className="p-3 font-semibold">الجداول</th>
                      <th className="p-3 font-semibold">الصفوف</th>
                      <th className="p-3 font-semibold">الحجم</th>
                      <th className="p-3 font-semibold">المدة</th>
                      <th className="p-3 font-semibold">الملف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t hover:bg-muted/20">
                        <td className="p-3">
                          {log.status === "success" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-300 gap-1">
                              <CheckCircle2 className="w-3 h-3" /> نجح
                            </Badge>
                          )}
                          {log.status === "failed" && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-300 gap-1">
                              <XCircle className="w-3 h-3" /> فشل
                            </Badge>
                          )}
                          {log.status === "running" && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-300 gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> قيد التنفيذ
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">{formatDate(log.started_at)}</td>
                        <td className="p-3">
                          {log.trigger_type === "manual" ? "يدوي" : "تلقائي"}
                        </td>
                        <td className="p-3">{log.tables_count || 0}</td>
                        <td className="p-3">{(log.total_rows || 0).toLocaleString("ar-SA")}</td>
                        <td className="p-3">{formatBytes(log.file_size_bytes || 0)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {log.duration_seconds ? `${log.duration_seconds.toFixed(1)} ث` : "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          {log.github_commit_url ? (
                            <a
                              href={log.github_commit_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              عرض <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : log.error_message ? (
                            <span className="text-red-600 text-xs" title={log.error_message}>
                              {log.error_message.slice(0, 40)}...
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* معلومات إضافية */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-5 text-sm text-muted-foreground space-y-2">
            <p>
              📌 <b>الجدولة التلقائية:</b> تعمل النسخ الاحتياطية كل يوم الساعة 3:00 صباحاً
              بتوقيت غرينتش (6:00 صباحاً بتوقيت السعودية).
            </p>
            <p>
              🔐 <b>الأمان:</b> المستودع <span className="font-mono">kfaah-database-backups</span>{" "}
              خاص (Private) وغير مرئي لأي شخص خارج حسابك.
            </p>
            <p>
              ♾️ <b>الاحتفاظ:</b> النسخ تُحفظ للأبد على GitHub بدون انتهاء صلاحية.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}