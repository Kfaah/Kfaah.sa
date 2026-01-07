import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Shield,
  Users,
  Settings,
  Eye,
  Edit,
  Trash2,
  ClipboardList,
  MessageSquare,
  BarChart3,
  Heart,
  ShoppingCart,
  CreditCard,
  UserCog,
} from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  employeeCount: number;
  permissions: string[];
}

const allPermissions: Permission[] = [
  { id: "view_dashboard", name: "عرض لوحة التحكم", description: "الوصول للوحة التحكم الرئيسية", icon: Eye },
  { id: "manage_employees", name: "إدارة الموظفين", description: "إضافة وتعديل وحذف الموظفين", icon: Users },
  { id: "manage_tasks", name: "إدارة المهام", description: "إنشاء وتوزيع المهام", icon: ClipboardList },
  { id: "view_reports", name: "عرض التقارير", description: "الوصول لتقارير الأداء", icon: BarChart3 },
  { id: "manage_campaigns", name: "إدارة الحملات", description: "إدارة حملات التبرع", icon: Heart },
  { id: "manage_carts", name: "السلات المتروكة", description: "متابعة السلات المتروكة", icon: ShoppingCart },
  { id: "manage_payments", name: "الاستقطاعات الدورية", description: "إدارة الدفع الدوري", icon: CreditCard },
  { id: "send_messages", name: "إرسال الرسائل", description: "إرسال رسائل للداعمين", icon: MessageSquare },
  { id: "system_settings", name: "إعدادات النظام", description: "تعديل إعدادات المنصة", icon: Settings },
];

const roles: Role[] = [
  {
    id: "1",
    name: "مجلس الإدارة",
    description: "صلاحيات كاملة للوصول لجميع أقسام المنصة والتقارير",
    color: "bg-purple-500",
    employeeCount: 3,
    permissions: allPermissions.map((p) => p.id),
  },
  {
    id: "2",
    name: "المشرف العام",
    description: "إدارة الموظفين وتوزيع المهام ومتابعة الأداء",
    color: "bg-blue-500",
    employeeCount: 1,
    permissions: ["view_dashboard", "manage_employees", "manage_tasks", "view_reports", "send_messages"],
  },
  {
    id: "3",
    name: "مسؤول الحملات وكبار الداعمين",
    description: "إدارة حملات التبرع والتواصل مع كبار الداعمين",
    color: "bg-green-500",
    employeeCount: 2,
    permissions: ["view_dashboard", "manage_campaigns", "send_messages"],
  },
  {
    id: "4",
    name: "مسؤول السلات المتروكة",
    description: "متابعة السلات المتروكة والتواصل مع المتبرعين المحتملين",
    color: "bg-orange-500",
    employeeCount: 2,
    permissions: ["view_dashboard", "manage_carts", "send_messages"],
  },
  {
    id: "5",
    name: "مسؤول الاستقطاع الدوري",
    description: "إدارة الاستقطاعات الدورية ومتابعة التبرعات الفاشلة",
    color: "bg-teal-500",
    employeeCount: 2,
    permissions: ["view_dashboard", "manage_payments", "send_messages"],
  },
  {
    id: "6",
    name: "مسؤول تطوير المتجر",
    description: "تحسين وتطوير صفحات المتجر الإلكتروني",
    color: "bg-pink-500",
    employeeCount: 2,
    permissions: ["view_dashboard", "view_reports"],
  },
];

const Roles = () => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الأدوار والصلاحيات</h1>
            <p className="text-muted-foreground mt-1">إدارة أدوار الموظفين وصلاحياتهم في المنصة</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة دور جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="lg:col-span-2 space-y-4">
            {roles.map((role) => (
              <Card
                key={role.id}
                className={`bg-card border-border hover:border-primary/50 transition-colors cursor-pointer ${
                  selectedRole?.id === role.id ? "border-primary" : ""
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${role.color}/20`}>
                        <Shield className={`w-6 h-6 ${role.color.replace("bg-", "text-")}`} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-lg">{role.name}</h3>
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                        <div className="flex items-center gap-4 pt-2">
                          <Badge variant="outline" className="gap-1">
                            <Users className="w-3 h-3" />
                            {role.employeeCount} موظف
                          </Badge>
                          <Badge variant="secondary" className="gap-1">
                            <Shield className="w-3 h-3" />
                            {role.permissions.length} صلاحية
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Permissions Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-primary" />
                  {selectedRole ? selectedRole.name : "الصلاحيات"}
                </CardTitle>
                <CardDescription>
                  {selectedRole
                    ? "تعديل صلاحيات هذا الدور"
                    : "اختر دوراً لعرض صلاحياته"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <div className="space-y-4">
                    {allPermissions.map((permission) => {
                      const hasPermission = selectedRole.permissions.includes(permission.id);
                      return (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <permission.icon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{permission.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            </div>
                          </div>
                          <Switch checked={hasPermission} />
                        </div>
                      );
                    })}
                    <Button className="w-full mt-4">حفظ التغييرات</Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>اختر دوراً من القائمة لعرض وتعديل صلاحياته</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Roles;
