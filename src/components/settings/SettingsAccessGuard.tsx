import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCanAccessSettings } from "@/hooks/useCanAccessSettings";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ShieldAlert } from "lucide-react";

/**
 * يحمي صفحات الإعدادات من الوصول غير المصرح به.
 * مسموح فقط لمدير النظام، مدير الجمعية (admin)، ومدير التسويق (moderator).
 */
export default function SettingsAccessGuard({ children }: { children: ReactNode }) {
  const { allowed, loading } = useCanAccessSettings();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center text-muted-foreground" dir="rtl">
          جارٍ التحقق من الصلاحيات...
        </div>
      </DashboardLayout>
    );
  }

  if (!allowed) {
    return (
      <DashboardLayout>
        <div
          dir="rtl"
          className="max-w-xl mx-auto mt-16 rounded-2xl border border-border bg-card p-10 text-center space-y-4 shadow-card"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">لا تملك صلاحية الوصول</h2>
          <p className="text-sm text-muted-foreground">
            صفحة الإعدادات متاحة فقط لمدير النظام، مدير الجمعية، ومدير التسويق.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}