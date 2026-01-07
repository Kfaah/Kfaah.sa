import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search,
  Plus,
  Filter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  User,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  PlayCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  assigneeInitials: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high";
  category: string;
  dueDate: string;
  createdAt: string;
}

const tasks: Task[] = [
  {
    id: "1",
    title: "متابعة السلات المتروكة - 15 سلة",
    description: "التواصل مع المتبرعين الذين تركوا سلاتهم دون إتمام التبرع",
    assignee: "أحمد محمد",
    assigneeInitials: "أم",
    status: "in_progress",
    priority: "high",
    category: "السلات المتروكة",
    dueDate: "2025-01-07",
    createdAt: "2025-01-07",
  },
  {
    id: "2",
    title: "التواصل مع كبار الداعمين",
    description: "إرسال تقرير شهري لكبار الداعمين عن إنجازات الجمعية",
    assignee: "سارة أحمد",
    assigneeInitials: "سأ",
    status: "pending",
    priority: "medium",
    category: "كبار الداعمين",
    dueDate: "2025-01-08",
    createdAt: "2025-01-07",
  },
  {
    id: "3",
    title: "تحديث صفحة حملة رمضان",
    description: "تحسين تصميم صفحة الحملة وإضافة محتوى جديد",
    assignee: "خالد علي",
    assigneeInitials: "خع",
    status: "completed",
    priority: "low",
    category: "تطوير المتجر",
    dueDate: "2025-01-06",
    createdAt: "2025-01-05",
  },
  {
    id: "4",
    title: "معالجة التبرعات الفاشلة - 8 تبرعات",
    description: "التواصل مع المتبرعين لإعادة محاولة الدفع",
    assignee: "فاطمة حسن",
    assigneeInitials: "فح",
    status: "in_progress",
    priority: "high",
    category: "التبرعات الفاشلة",
    dueDate: "2025-01-07",
    createdAt: "2025-01-07",
  },
  {
    id: "5",
    title: "متابعة الاستقطاعات المتوقفة",
    description: "التواصل مع المتبرعين الذين توقفت استقطاعاتهم الدورية",
    assignee: "محمد سعيد",
    assigneeInitials: "مس",
    status: "overdue",
    priority: "high",
    category: "الاستقطاع الدوري",
    dueDate: "2025-01-05",
    createdAt: "2025-01-03",
  },
  {
    id: "6",
    title: "إعداد تقرير الأداء الأسبوعي",
    description: "جمع بيانات الأداء وإعداد التقرير للمشرف",
    assignee: "نورة عبدالله",
    assigneeInitials: "نع",
    status: "pending",
    priority: "medium",
    category: "التقارير",
    dueDate: "2025-01-09",
    createdAt: "2025-01-07",
  },
];

const Tasks = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return { label: "مكتمل", class: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle };
      case "in_progress":
        return { label: "قيد التنفيذ", class: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: PlayCircle };
      case "overdue":
        return { label: "متأخر", class: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle };
      default:
        return { label: "معلق", class: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: Clock };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "high":
        return { label: "عاجل", class: "bg-destructive text-destructive-foreground" };
      case "medium":
        return { label: "متوسط", class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
      default:
        return { label: "عادي", class: "bg-secondary text-secondary-foreground" };
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.includes(searchQuery) ||
      task.assignee.includes(searchQuery) ||
      task.category.includes(searchQuery);

    if (activeTab === "all") return matchesSearch;
    return matchesSearch && task.status === activeTab;
  });

  const taskStats = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">المهام</h1>
            <p className="text-muted-foreground mt-1">إدارة ومتابعة مهام الموظفين</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة مهمة
          </Button>
        </div>

        {/* Tabs and Search */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="gap-2">
                  الكل
                  <Badge variant="secondary" className="text-xs">{taskStats.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  معلق
                  <Badge variant="secondary" className="text-xs">{taskStats.pending}</Badge>
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="gap-2">
                  قيد التنفيذ
                  <Badge variant="secondary" className="text-xs">{taskStats.in_progress}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  مكتمل
                  <Badge variant="secondary" className="text-xs">{taskStats.completed}</Badge>
                </TabsTrigger>
                <TabsTrigger value="overdue" className="gap-2">
                  متأخر
                  <Badge variant="secondary" className="text-xs">{taskStats.overdue}</Badge>
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="البحث..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10 w-64"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-4">
                {filteredTasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status);
                  const priorityConfig = getPriorityConfig(task.priority);

                  return (
                    <Card key={task.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <Avatar className="w-10 h-10 bg-primary/20">
                              <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                                {task.assigneeInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground truncate">{task.title}</h3>
                                <Badge className={priorityConfig.class}>{priorityConfig.label}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <User className="w-4 h-4" />
                                  <span>{task.assignee}</span>
                                </div>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  <span>{task.dueDate}</span>
                                </div>
                                <Badge variant="outline">{task.category}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusConfig.class}>
                              <statusConfig.icon className="w-3 h-3 ml-1" />
                              {statusConfig.label}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem className="gap-2">
                                  <Eye className="w-4 h-4" /> عرض التفاصيل
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                  <Edit className="w-4 h-4" /> تعديل
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2 text-destructive">
                                  <Trash2 className="w-4 h-4" /> حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tasks;
