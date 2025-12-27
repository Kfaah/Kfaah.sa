import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Mail, Phone, Building2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  status: "active" | "on_leave" | "inactive";
  joinDate: string;
  salary: number;
}

const employees: Employee[] = [
  { id: "1", name: "أحمد محمد", email: "ahmed@company.com", phone: "+966 50 111 2222", department: "المبيعات", position: "مدير المبيعات", status: "active", joinDate: "2022-01-15", salary: 15000 },
  { id: "2", name: "نورة سعد", email: "noura@company.com", phone: "+966 55 333 4444", department: "التسويق", position: "أخصائي تسويق", status: "active", joinDate: "2022-06-01", salary: 9000 },
  { id: "3", name: "يوسف خالد", email: "yousef@company.com", phone: "+966 54 555 6666", department: "خدمة العملاء", position: "ممثل خدمة عملاء", status: "on_leave", joinDate: "2023-02-20", salary: 7000 },
  { id: "4", name: "مريم علي", email: "mariam@company.com", phone: "+966 56 777 8888", department: "الموارد البشرية", position: "مسؤول موارد بشرية", status: "active", joinDate: "2021-09-10", salary: 11000 },
  { id: "5", name: "عبدالله حسن", email: "abdullah@company.com", phone: "+966 59 999 0000", department: "المالية", position: "محاسب", status: "active", joinDate: "2023-04-05", salary: 10000 },
];

const statusConfig = {
  active: { label: "نشط", className: "bg-success/10 text-success" },
  on_leave: { label: "في إجازة", className: "bg-warning/10 text-warning" },
  inactive: { label: "غير نشط", className: "bg-muted text-muted-foreground" },
};

const Employees = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = employees.filter((employee) =>
    employee.name.includes(searchQuery) || employee.department.includes(searchQuery)
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
          { label: "إجمالي الموظفين", value: 24 },
          { label: "نشطين", value: 21 },
          { label: "في إجازة", value: 2 },
          { label: "الأقسام", value: 5 },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="bg-card rounded-xl p-4 shadow-card animate-slide-up"
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
            className="bg-card rounded-xl shadow-card p-6 hover:shadow-card-hover transition-all duration-300 animate-slide-up"
            style={{ animationDelay: `${250 + index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-lg font-bold text-accent-foreground">
                  {employee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                </div>
              </div>
              <Badge className={cn("text-xs", statusConfig[employee.status].className)}>
                {statusConfig[employee.status].label}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                {employee.department}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                {employee.email}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                {employee.phone}
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">الراتب</p>
                <p className="font-bold">{employee.salary.toLocaleString()} ر.س</p>
              </div>
              <div className="text-left">
                <p className="text-muted-foreground text-sm">تاريخ الانضمام</p>
                <p className="font-medium">{employee.joinDate}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default Employees;
