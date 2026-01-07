import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Mail, Phone, Users, UserCheck, Clock, TrendingUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleColor: string;
  status: "active" | "on_leave" | "inactive";
  joinDate: string;
  tasksCompleted: number;
  tasksTotal: number;
  performance: number;
}

const employees: Employee[] = [
  { id: "1", name: "أحمد محمد", email: "ahmed@atef.org", phone: "+966 50 111 2222", role: "مسؤول السلات المتروكة", roleColor: "bg-rose-500", status: "active", joinDate: "2022-01-15", tasksCompleted: 45, tasksTotal: 50, performance: 92 },
  { id: "2", name: "سارة أحمد", email: "sara@atef.org", phone: "+966 55 333 4444", role: "مسؤول الحملات وكبار الداعمين", roleColor: "bg-emerald-500", status: "active", joinDate: "2022-06-01", tasksCompleted: 38, tasksTotal: 42, performance: 88 },
  { id: "3", name: "محمد سعيد", email: "mohammed@atef.org", phone: "+966 54 555 6666", role: "مسؤول الاستقطاع الدوري", roleColor: "bg-accent", status: "on_leave", joinDate: "2023-02-20", tasksCompleted: 28, tasksTotal: 35, performance: 80 },
  { id: "4", name: "فاطمة حسن", email: "fatima@atef.org", phone: "+966 56 777 8888", role: "مسؤول السلات المتروكة", roleColor: "bg-rose-500", status: "active", joinDate: "2021-09-10", tasksCompleted: 52, tasksTotal: 55, performance: 95 },
  { id: "5", name: "خالد علي", email: "khaled@atef.org", phone: "+966 59 999 0000", role: "مسؤول تطوير المتجر", roleColor: "bg-violet-500", status: "active", joinDate: "2023-04-05", tasksCompleted: 22, tasksTotal: 25, performance: 85 },
  { id: "6", name: "نورة عبدالله", email: "noura@atef.org", phone: "+966 58 888 1111", role: "مسؤول الاستقطاع الدوري", roleColor: "bg-accent", status: "active", joinDate: "2023-06-15", tasksCompleted: 30, tasksTotal: 32, performance: 94 },
  { id: "7", name: "عبدالرحمن الشهري", email: "abdulrahman@atef.org", phone: "+966 53 222 3333", role: "المشرف العام", roleColor: "bg-primary", status: "active", joinDate: "2021-03-01", tasksCompleted: 60, tasksTotal: 62, performance: 97 },
];

const statusConfig = {
  active: { label: "نشط", className: "bg-emerald-100 text-emerald-600 border-emerald-200" },
  on_leave: { label: "في إجازة", className: "bg-amber-100 text-amber-600 border-amber-200" },
  inactive: { label: "غير نشط", className: "bg-muted text-muted-foreground border-border" },
};

const getPerformanceColor = (performance: number) => {
  if (performance >= 90) return "text-emerald-500";
  if (performance >= 75) return "text-amber-500";
  return "text-rose-500";
};

const getPerformanceBarColor = (performance: number) => {
  if (performance >= 90) return "bg-emerald-500";
  if (performance >= 75) return "bg-amber-500";
  return "bg-rose-500";
};

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = employees.filter((employee) =>
    employee.name.includes(searchQuery) || employee.role.includes(searchQuery)
  );

  const stats = [
    { label: "إجمالي الموظفين", value: employees.length, icon: Users, iconBg: "bg-accent/10", iconColor: "text-accent" },
    { label: "نشطين", value: employees.filter(e => e.status === "active").length, icon: UserCheck, iconBg: "bg-emerald-100", iconColor: "text-emerald-500" },
    { label: "في إجازة", value: employees.filter(e => e.status === "on_leave").length, icon: Clock, iconBg: "bg-amber-100", iconColor: "text-amber-500" },
    { label: "متوسط الأداء", value: `${Math.round(employees.reduce((acc, e) => acc + e.performance, 0) / employees.length)}%`, icon: TrendingUp, iconBg: "bg-violet-100", iconColor: "text-violet-500" },
  ];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموظفين</h1>
          <p className="text-muted-foreground mt-1">إدارة فريق العمل</p>
        </div>
        <Button className="gap-2 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
          <Plus className="w-4 h-4" />
          إضافة موظف
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className="bg-card rounded-3xl shadow-card animate-slide-up border-border"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.iconBg)}>
                <stat.icon className={cn("w-6 h-6", stat.iconColor)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن موظف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-12 rounded-2xl bg-card border-border"
          />
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee, index) => (
          <Card
            key={employee.id}
            className="bg-card rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up border-border overflow-hidden"
            style={{ animationDelay: `${250 + index * 50}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-lg font-bold text-primary-foreground shadow-md">
                    {employee.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{employee.name}</h3>
                    <p className={cn("text-xs mt-1", employee.roleColor.replace("bg-", "text-"))}>
                      {employee.role}
                    </p>
                  </div>
                </div>
                <Badge className={cn("text-xs rounded-full border", statusConfig[employee.status].className)}>
                  {statusConfig[employee.status].label}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {employee.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {employee.phone}
                </div>
              </div>

              {/* Performance Section */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">الأداء</span>
                  <span className={cn("font-bold", getPerformanceColor(employee.performance))}>
                    {employee.performance}%
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", getPerformanceBarColor(employee.performance))}
                    style={{ width: `${employee.performance}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-muted-foreground">المهام المنجزة</span>
                  <span className="font-medium">{employee.tasksCompleted}/{employee.tasksTotal}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Employees;
