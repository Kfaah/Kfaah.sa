import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  RefreshCcw,
  CheckCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high";
  estimatedTime: string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  roleId: string;
  roleName: string;
  roleColor: string;
  isActive: boolean;
  frequency: "daily" | "weekly" | "monthly";
  workDays: string[];
  taskTemplates: TaskTemplate[];
  assignedEmployees: { id: string; name: string; initials: string }[];
  tasksGenerated: number;
  lastGenerated: string;
}

const plans: Plan[] = [
  {
    id: "1",
    name: "خطة السلات المتروكة اليومية",
    description: "متابعة السلات المتروكة والتواصل مع المتبرعين المحتملين يومياً",
    roleId: "4",
    roleName: "مسؤول السلات المتروكة",
    roleColor: "bg-orange-500",
    isActive: true,
    frequency: "daily",
    workDays: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
    taskTemplates: [
      {
        id: "t1",
        title: "مراجعة السلات المتروكة الجديدة",
        description: "فحص السلات التي تركت خلال آخر 24 ساعة",
        category: "السلات المتروكة",
        priority: "high",
        estimatedTime: "30 دقيقة",
      },
      {
        id: "t2",
        title: "إرسال تذكير واتساب للسلات",
        description: "إرسال رسائل تذكيرية للمتبرعين",
        category: "السلات المتروكة",
        priority: "medium",
        estimatedTime: "45 دقيقة",
      },
      {
        id: "t3",
        title: "تحديث تقرير السلات",
        description: "تسجيل نتائج المتابعة في النظام",
        category: "السلات المتروكة",
        priority: "low",
        estimatedTime: "15 دقيقة",
      },
    ],
    assignedEmployees: [
      { id: "e1", name: "أحمد محمد", initials: "أم" },
      { id: "e2", name: "فاطمة حسن", initials: "فح" },
    ],
    tasksGenerated: 156,
    lastGenerated: "2025-01-07",
  },
  {
    id: "2",
    name: "خطة كبار الداعمين",
    description: "التواصل المستمر مع كبار الداعمين وتقديم التقارير لهم",
    roleId: "3",
    roleName: "مسؤول الحملات وكبار الداعمين",
    roleColor: "bg-green-500",
    isActive: true,
    frequency: "weekly",
    workDays: ["الأحد", "الأربعاء"],
    taskTemplates: [
      {
        id: "t4",
        title: "إعداد تقرير أسبوعي لكبار الداعمين",
        description: "جمع البيانات وإعداد التقرير",
        category: "كبار الداعمين",
        priority: "high",
        estimatedTime: "2 ساعة",
      },
      {
        id: "t5",
        title: "التواصل مع الداعمين الجدد",
        description: "ترحيب وشكر للداعمين الجدد",
        category: "كبار الداعمين",
        priority: "medium",
        estimatedTime: "1 ساعة",
      },
    ],
    assignedEmployees: [
      { id: "e3", name: "سارة أحمد", initials: "سأ" },
    ],
    tasksGenerated: 48,
    lastGenerated: "2025-01-05",
  },
  {
    id: "3",
    name: "خطة الاستقطاع الدوري",
    description: "متابعة الاستقطاعات الدورية ومعالجة التبرعات الفاشلة",
    roleId: "5",
    roleName: "مسؤول الاستقطاع الدوري",
    roleColor: "bg-teal-500",
    isActive: true,
    frequency: "daily",
    workDays: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
    taskTemplates: [
      {
        id: "t6",
        title: "معالجة التبرعات الفاشلة",
        description: "التواصل مع المتبرعين لتحديث بيانات الدفع",
        category: "التبرعات الفاشلة",
        priority: "high",
        estimatedTime: "1 ساعة",
      },
      {
        id: "t7",
        title: "مراجعة الاستقطاعات المتوقفة",
        description: "فحص الحسابات المتوقفة والتواصل مع أصحابها",
        category: "الاستقطاع الدوري",
        priority: "high",
        estimatedTime: "45 دقيقة",
      },
    ],
    assignedEmployees: [
      { id: "e4", name: "محمد سعيد", initials: "مس" },
      { id: "e5", name: "نورة عبدالله", initials: "نع" },
    ],
    tasksGenerated: 134,
    lastGenerated: "2025-01-07",
  },
  {
    id: "4",
    name: "خطة تطوير المتجر",
    description: "تحسين صفحات المتجر وتحديث المحتوى",
    roleId: "6",
    roleName: "مسؤول تطوير المتجر",
    roleColor: "bg-pink-500",
    isActive: false,
    frequency: "weekly",
    workDays: ["الأحد", "الثلاثاء", "الخميس"],
    taskTemplates: [
      {
        id: "t8",
        title: "مراجعة تصميم صفحات الحملات",
        description: "فحص وتحسين تصميم الصفحات",
        category: "تطوير المتجر",
        priority: "medium",
        estimatedTime: "2 ساعة",
      },
    ],
    assignedEmployees: [
      { id: "e6", name: "خالد علي", initials: "خع" },
    ],
    tasksGenerated: 28,
    lastGenerated: "2025-01-03",
  },
];

const frequencyLabels = {
  daily: "يومياً",
  weekly: "أسبوعياً",
  monthly: "شهرياً",
};

const Plans = () => {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "high":
        return { label: "عاجل", class: "bg-destructive text-destructive-foreground" };
      case "medium":
        return { label: "متوسط", class: "bg-yellow-500/20 text-yellow-400" };
      default:
        return { label: "عادي", class: "bg-secondary text-secondary-foreground" };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الخطط</h1>
            <p className="text-muted-foreground mt-1">
              إدارة خطط العمل والمهام التلقائية للموظفين
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إنشاء خطة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>إنشاء خطة جديدة</DialogTitle>
                <DialogDescription>
                  أضف خطة عمل جديدة لتوزيع المهام تلقائياً على الموظفين
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الخطة</Label>
                  <Input placeholder="مثال: خطة متابعة السلات اليومية" />
                </div>
                <div className="space-y-2">
                  <Label>الوصف</Label>
                  <Textarea placeholder="وصف تفصيلي للخطة..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الدور المستهدف</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الدور" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">مسؤول الحملات وكبار الداعمين</SelectItem>
                        <SelectItem value="4">مسؤول السلات المتروكة</SelectItem>
                        <SelectItem value="5">مسؤول الاستقطاع الدوري</SelectItem>
                        <SelectItem value="6">مسؤول تطوير المتجر</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>التكرار</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التكرار" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">يومياً</SelectItem>
                        <SelectItem value="weekly">أسبوعياً</SelectItem>
                        <SelectItem value="monthly">شهرياً</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full">إنشاء الخطة</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الخطط", value: plans.length, icon: Target, color: "text-primary" },
            { label: "خطط نشطة", value: plans.filter(p => p.isActive).length, icon: Play, color: "text-green-500" },
            { label: "مهام تم توليدها", value: plans.reduce((acc, p) => acc + p.tasksGenerated, 0), icon: Zap, color: "text-yellow-500" },
            { label: "موظفين معينين", value: plans.reduce((acc, p) => acc + p.assignedEmployees.length, 0), icon: Users, color: "text-blue-500" },
          ].map((stat, index) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`bg-card border-border transition-all ${
                !plan.isActive ? "opacity-60" : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${plan.roleColor}/20`}>
                      <Calendar className={`w-6 h-6 ${plan.roleColor.replace("bg-", "text-")}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <Badge variant={plan.isActive ? "default" : "secondary"}>
                          {plan.isActive ? "نشط" : "متوقف"}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">{plan.description}</CardDescription>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <Badge variant="outline" className={`${plan.roleColor}/20 ${plan.roleColor.replace("bg-", "text-")}`}>
                          {plan.roleName}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <RefreshCcw className="w-3 h-3" />
                          {frequencyLabels[plan.frequency]}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {plan.tasksGenerated} مهمة
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2 space-x-reverse">
                      {plan.assignedEmployees.slice(0, 3).map((emp) => (
                        <Avatar key={emp.id} className="w-8 h-8 border-2 border-card">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {emp.initials}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {plan.assignedEmployees.length > 3 && (
                        <Avatar className="w-8 h-8 border-2 border-card">
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            +{plan.assignedEmployees.length - 3}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <Switch checked={plan.isActive} />
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setExpandedPlan(expandedPlan === plan.id ? null : plan.id)
                      }
                    >
                      {expandedPlan === plan.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedPlan === plan.id && (
                <CardContent className="pt-4 border-t border-border mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">قوالب المهام</h4>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Plus className="w-3 h-3" />
                        إضافة مهمة
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      {plan.taskTemplates.map((template, index) => {
                        const priorityConfig = getPriorityConfig(template.priority);
                        return (
                          <div
                            key={template.id}
                            className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-4">
                              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </span>
                              <div>
                                <p className="font-medium">{template.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {template.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={priorityConfig.class}>
                                {priorityConfig.label}
                              </Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                {template.estimatedTime}
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">أيام العمل</p>
                        <div className="flex flex-wrap gap-2">
                          {plan.workDays.map((day) => (
                            <Badge key={day} variant="secondary">
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">آخر توليد للمهام</p>
                        <p className="font-medium">{plan.lastGenerated}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Plans;
