import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Palette, Bell, Shield, Database, FileDown } from "lucide-react";
import { WelcomeContentManager } from "@/components/welcome/WelcomeContentManager";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exportGrantProposal } from "@/utils/exportGrantProposal";
import { toast } from "sonner";

export default function Settings() {
  const { user: authUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!authUser) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: authUser.id,
        _role: "admin",
      });
      setIsAdmin(data === true);
    };
    checkAdminRole();
  }, [authUser]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          icon={<SettingsIcon className="w-6 h-6" />}
          title="الإعدادات"
          subtitle="إدارة إعدادات النظام"
        />

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Welcome Screen Settings - Admin Only */}
          {isAdmin && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Palette className="w-5 h-5 text-white" />
                  </div>
                  شاشة الترحيب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  إدارة خلفيات وعبارات شاشة الترحيب للموظفين
                </p>
                <WelcomeContentManager />
              </CardContent>
            </Card>
          )}

          {/* تصدير ملف المانح */}
          {isAdmin && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                    <FileDown className="w-5 h-5 text-white" />
                  </div>
                  ملف تقديم المشروع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  تصدير ملف تقديم المشروع للمانحين بصيغة Word
                </p>
                <Button
                  onClick={async () => {
                    try {
                      await exportGrantProposal();
                      toast.success("تم تصدير الملف بنجاح");
                    } catch (e) {
                      toast.error("حدث خطأ أثناء التصدير");
                    }
                  }}
                  className="w-full"
                >
                  <FileDown className="w-4 h-4 ml-2" />
                  تحميل ملف Word
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Placeholder for future settings */}
          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-white" />
                </div>
                الإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                إعدادات الإشعارات قريباً...
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                الأمان
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                إعدادات الأمان قريباً...
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                النسخ الاحتياطي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                إعدادات النسخ الاحتياطي قريباً...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
