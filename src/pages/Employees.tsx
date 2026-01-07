import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Mail, Phone } from "lucide-react";
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
  { id: "1", name: "أحمد محمد", email: "ahmed@atef.org", phone: "+966 50 111 2222", role: "مسؤول السلات المتروكة", roleColor: "bg-orange-500", status: "active", joinDate: "2022-01-15", tasksCompleted: 45, tasksTotal: 50, performance: 92 },
  { id: "2", name: "سارة أحمد", email: "sara@atef.org", phone: "+966 55 333 4444", role: "مسؤول الحملات وكبار الداعمين", roleColor: "bg-green-500", status: "active", joinDate: "2022-06-01", tasksCompleted: 38, tasksTotal: 42, performance: 88 },
  { id: "3", name: "محمد سعيد", email: "mohammed@atef.org", phone: "+966 54 555 6666", role: "مسؤول الاستقطاع الدوري", roleColor: "bg-teal-500", status: "on_leave", joinDate: "2023-02-20", tasksCompleted: 28, tasksTotal: 35, performance: 80 },
  { id: "4", name: "فاطمة حسن", email: "fatima@atef.org", phone: "+966 56 777 8888", role: "مسؤول السلات المتروكة", roleColor: "bg-orange-500", status: "active", joinDate: "2021-09-10", tasksCompleted: 52, tasksTotal: 55, performance: 95 },
  { id: "5", name: "خالد علي", email: "khaled@atef.org", phone: "+966 59 999 0000", role: "مسؤول تطوير المتجر", roleColor: "bg-pink-500", status: "active", joinDate: "2023-04-05", tasksCompleted: 22, tasksTotal: 25, performance: 85 },
  { id: "6", name: "نورة عبدالله", email: "noura@atef.org", phone: "+966 58 888 1111", role: "مسؤول الاستقطاع الدوري", roleColor: "bg-teal-500", status: "active", joinDate: "2023-06-15", tasksCompleted: 30, tasksTotal: 32, performance: 94 },
  { id: "7", name: "عبدالرحمن الشهري", email: "abdulrahman@atef.org", phone: "+966 53 222 3333", role: "المشرف العام", roleColor: "bg-blue-500", status: "active", joinDate: "2021-03-01", tasksCompleted: 60, tasksTotal: 62, performance: 97 },
];

const statusConfig = {
  active: { label: "نشط", className: "bg-green-500/20 text-green-400" },
  on_leave: { label: "في إجازة", className: "bg-yellow-500/20 text-yellow-400" },
  inactive: { label: "غير نشط", className: "bg-muted text-muted-foreground" },
};

const getPerformanceColor = (performance: number) => {
  if (performance >= 90) return "text-green-400";
  if (performance >= 75) return "text-yellow-400";
  return "text-red-400";
};

const getPerformanceBarColor = (performance: number) => {
  if (performance >= 90) return "bg-green-500";
  if (performance >= 75) return "bg-yellow-500";
  return "bg-red-500";
};

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = employees.filter((employee) =>
    employee.name.includes(searchQuery) || employee.role.includes(searchQuery)
  );

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">الموظفين</h1>
          <p className="text-muted-foreground mt-1">إدارة فريق العمل</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة موظف
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "إجمالي الموظفين", value: employees.length },
          { label: "نشطين", value: employees.filter(e => e.status === "active").length },
          { label: "في إجازة", value: employees.filter(e => e.status === "on_leave").length },
          { label: "متوسط الأداء", value: `${Math.round(employees.reduce((acc, e) => acc + e.performance, 0) / employees.length)}%` },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="bg-card rounded-xl p-4 shadow-card animate-slide-up border border-border"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن موظف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee, index) => (
          <div
            key={employee.id}
            className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-slide-up border border-border"
            style={{ animationDelay: `${250 + index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold">{employee.name}</h3>
                  <Badge className={cn("text-xs mt-1", `${employee.roleColor}/20 ${employee.roleColor.replace("bg-", "text-")}`)}>
                    {employee.role}
                  </Badge>
                </div>
              </div>
              <Badge className={cn("text-xs", statusConfig[employee.status].className)}>
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

            <div className="pt-4 border-t border-border mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">تاريخ الانضمام</span>
              <span className="font-medium">{employee.joinDate}</span>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Employees;
