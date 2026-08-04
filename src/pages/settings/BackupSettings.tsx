import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Lock,
  CloudOff,
  KeyRound,
  RotateCcw,
  PlayCircle,
  Loader2,
  Database,
} from "lucide-react";

type BackupLog = {
  id: string;
  status: string;
  tables_count: number;
  rows_count: number;
  files_count: number;
  total_bytes: number;
  parts_count: number;
  errors_count: number;
  error_summary: string | null;
  remote_path: string | null;
  started_at: string;
  finished_at: string | null;
};

const statusLabel: Record<string, string> = {
  running: "قيد التنفيذ",
  success: "ناجحة",
  partial: "ناجحة جزئياً",
  failed: "فاشلة",
};

function formatBytes(bytes: number) {
  if (!bytes) return "0";
  const units = ["بايت", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export default function BackupSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  const { user } = useAuth();
  const [isSuper, setIsSuper] = useState(false);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("secure_backup_logs")
      .select(
        "id,status,tables_count,rows_count,files_count,total_bytes,parts_count,errors_count,error_summary,remote_path,started_at,finished_at"
      )
      .order("started_at", { ascending: false })
      .limit(10);
    setLogs((data ?? []) as BackupLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "super_admin",
      });
      setIsSuper(data === true);
      await loadLogs();
    };
    init();
  }, [user, loadLogs]);

  const runBackup = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("secure-backup-to-github");
      if (error) throw error;
      toast({ title: "تم تشغيل النسخة المشفّرة", description: "سيظهر السجل بعد اكتمال العملية." });
    } catch (e) {
      toast({
        title: "تعذّر تشغيل النسخة",
        description: e instanceof Error ? e.message : "خطأ غير معروف",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
      await loadLogs();
    }
  };

  const last = logs[0];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<ShieldCheck className="w-6 h-6" />}
            title="النسخ الاحتياطي"
            subtitle="حالة منظومة النسخ الاحتياطي وسياسة حماية البيانات"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة للإعدادات
            </Link>
          </Button>
        </div>

        <Card className="border-emerald-300/60 bg-emerald-500/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">النسخ المشفّر مُفعَّل</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    كل نسخة تُشفَّر قبل الرفع (AES‑256‑GCM للبيانات + RSA‑OAEP لمفتاح التشفير)،
                    وتُرفع الأجزاء المشفّرة فقط. المفتاح الخاص غير موجود داخل المنصة.
                  </p>
                </div>
              </div>
              {isSuper && (
                <Button onClick={runBackup} disabled={running}>
                  {running ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 ml-2" />
                  )}
                  تشغيل نسخة الآن
                </Button>
              )}
            </div>

            {last && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[
                  { label: "الحالة", value: statusLabel[last.status] ?? last.status },
                  { label: "الجداول", value: String(last.tables_count) },
                  { label: "الصفوف", value: last.rows_count.toLocaleString("ar-SA") },
                  { label: "الملفات", value: `${last.files_count} (${formatBytes(last.total_bytes)})` },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-card border border-border p-3">
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    <div className="font-bold text-sm mt-1">{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Database className="w-5 h-5" /> سجل آخر العمليات
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد عمليات مسجّلة بعد.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm flex-wrap"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          l.status === "success"
                            ? "border-emerald-400 text-emerald-700"
                            : l.status === "failed"
                            ? "border-destructive text-destructive"
                            : "border-amber-400 text-amber-700"
                        }
                      >
                        {statusLabel[l.status] ?? l.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(l.started_at).toLocaleString("ar-SA")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.tables_count} جدول · {l.files_count} ملف · {l.parts_count} جزء مشفّر
                      {l.errors_count > 0 ? ` · ${l.errors_count} خطأ` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-300/60 bg-amber-500/5">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">النسخ الخام إلى GitHub موقوف</h3>
                  <Badge variant="outline" className="border-amber-400 text-amber-700">
                    موقوف لأسباب أمنية
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  لم تعد بيانات المنصة تُصدَّر إلى مستودعات GitHub. تصدير جداول قاعدة البيانات
                  بصيغة نصية واضحة إلى نظام إدارة كود يعني بقاء بيانات شخصية في سجل تاريخي دائم،
                  وهو ما يخالف مبادئ حماية البيانات. تم إزالة هذه الوظيفة بالكامل.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center">
                <CloudOff className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="font-bold">GitHub للكود فقط</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                يُستخدم المستودع للكود ومخططات قاعدة البيانات. لا بيانات مستخدمين ولا مرفقات
                ولا كلمات مرور.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="font-bold">نسخ مشفّرة إلى تخزين خارجي</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                النسخ القادمة تُشفَّر (AES‑256) قبل الرفع، وتُخزَّن في سلة خاصة متوافقة مع
                S3 / Cloudflare R2 مع سياسة احتفاظ محددة.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-blue-600" />
              </div>
              <div className="font-bold">اختبار استعادة دوري</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                اختبار استعادة شهري على قاعدة بيانات اختبارية. أي نسخة لم تُختبر استعادتها
                لا تُعتبر نسخة موثوقة.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              متطلبات الاستعادة
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc ps-5 leading-relaxed">
              <li>المفتاح الخاص (RSA) محفوظ خارج المنصة وخارج المستودع — بدونه لا يمكن فك أي نسخة.</li>
              <li>يتم التحقق من SHA‑256 لكل جزء مقابل الـ manifest قبل أي استعادة.</li>
              <li>الاستعادة افتراضياً إلى قاعدة اختبار، وتتطلب تأكيداً صريحاً.</li>
              <li>اختبار استعادة شهري إلزامي؛ نسخة لم تُختبر لا تُعتبر موثوقة.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              التفاصيل الكاملة في <span className="font-mono">scripts/backup/README.md</span>{" "}
              و<span className="font-mono">docs/BACKUP_SECURITY.md</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
