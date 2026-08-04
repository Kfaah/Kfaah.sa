import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Lock,
  CloudOff,
  KeyRound,
  RotateCcw,
} from "lucide-react";

export default function BackupSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";

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
              ما يلزم قبل تشغيل النسخ الآمن
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc ps-5 leading-relaxed">
              <li>سلة تخزين خاصة (S3 أو R2) مع تفعيل الإصدارات ومنع الوصول العام.</li>
              <li>مفاتيح وصول للتخزين بأقل صلاحية ممكنة (كتابة في مسار النسخ فقط).</li>
              <li>عبارة تشفير سرية محفوظة في مدير أسرار، لا في الكود ولا في المستودع.</li>
              <li>تفعيل التشغيل المجدول بعد التحقق من نجاح تشغيل يدوي واحد على الأقل.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              التفاصيل الكاملة موثّقة في <span className="font-mono">docs/BACKUP_SECURITY.md</span>{" "}
              وسكربتات النسخ النموذجية في <span className="font-mono">scripts/backup/</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
