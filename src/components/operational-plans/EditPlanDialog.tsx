import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Folder, Activity, User, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

interface StrategicGoal {
  id: string;
  name: string;
  color: string;
  year: number;
  department_id: string | null;
  department_name?: string;
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
  department_id: string | null;
  department_name?: string;
}

interface OperationalPlan {
  id: string;
  user_id: string;
  activity_name: string;
  strategic_goal: string | null;
  initiative: string | null;
  strategic_goal_id: string | null;
  initiative_id: string | null;
  annual_target: number;
  year: number;
  status: string;
  created_at: string;
  months?: { id: string; operational_plan_id: string; month: number; monthly_target: number }[];
  employee_name?: string;
  responsible_employee_id: string | null;
  responsible_employee_name?: string;
}

type EditType = "strategic_goal" | "initiative" | "activity";

interface EditPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editType: EditType;
  plan: OperationalPlan | null;
  strategicGoalName?: string;
  initiativeName?: string;
  strategicGoals: StrategicGoal[];
  initiatives: Initiative[];
  departments: Department[];
  employees: Employee[];
  onSave: () => void;
  onDelete?: () => void;
}

export function EditPlanDialog({
  open,
  onOpenChange,
  editType,
  plan,
  strategicGoalName,
  initiativeName,
  strategicGoals,
  initiatives,
  departments,
  employees,
  onSave,
  onDelete,
}: EditPlanDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // الهدف الاستراتيجي
  const [goalName, setGoalName] = useState("");
  const [goalDepartmentId, setGoalDepartmentId] = useState<string>("");

  // المبادرة
  const [initName, setInitName] = useState("");
  const [initDepartmentId, setInitDepartmentId] = useState<string>("");

  // النشاط
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState<number>(0);
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<string>("");

  useEffect(() => {
    if (open) {
      if (editType === "strategic_goal" && strategicGoalName) {
        const goal = strategicGoals.find(g => g.name === strategicGoalName);
        setGoalName(strategicGoalName);
        setGoalDepartmentId(goal?.department_id || "none");
      } else if (editType === "initiative" && initiativeName) {
        const init = initiatives.find(i => i.name === initiativeName);
        setInitName(initiativeName);
        setInitDepartmentId(init?.department_id || "none");
      } else if (editType === "activity" && plan) {
        setActivityName(plan.activity_name);
        setAnnualTarget(plan.annual_target);
        setResponsibleEmployeeId(plan.responsible_employee_id || "none");
      }
    }
  }, [open, editType, plan, strategicGoalName, initiativeName, strategicGoals, initiatives]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editType === "strategic_goal") {
        const goal = strategicGoals.find(g => g.name === strategicGoalName);
        if (goal) {
          const { error } = await supabase
            .from("strategic_goals")
            .update({
              name: goalName,
              department_id: goalDepartmentId === "none" ? null : goalDepartmentId,
            })
            .eq("id", goal.id);
          if (error) throw error;

          // تحديث اسم الهدف في الخطط
          if (goalName !== strategicGoalName) {
            await supabase
              .from("operational_plans")
              .update({ strategic_goal: goalName })
              .eq("strategic_goal", strategicGoalName);
          }
        }
        toast({ title: "تم الحفظ", description: "تم تحديث الهدف الاستراتيجي" });
      } else if (editType === "initiative") {
        const init = initiatives.find(i => i.name === initiativeName);
        if (init) {
          const { error } = await supabase
            .from("initiatives")
            .update({
              name: initName,
              department_id: initDepartmentId === "none" ? null : initDepartmentId,
            })
            .eq("id", init.id);
          if (error) throw error;

          // تحديث اسم المبادرة في الخطط
          if (initName !== initiativeName) {
            await supabase
              .from("operational_plans")
              .update({ initiative: initName })
              .eq("initiative", initiativeName);
          }
        }
        toast({ title: "تم الحفظ", description: "تم تحديث المبادرة" });
      } else if (editType === "activity" && plan) {
        const { error } = await supabase
          .from("operational_plans")
          .update({
            activity_name: activityName,
            annual_target: annualTarget,
            responsible_employee_id: responsibleEmployeeId === "none" ? null : responsibleEmployeeId,
          })
          .eq("id", plan.id);
        if (error) throw error;
        toast({ title: "تم الحفظ", description: "تم تحديث النشاط" });
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حفظ التغييرات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (editType === "activity" && plan) {
      if (!confirm("هل أنت متأكد من حذف هذا النشاط؟")) return;
      onDelete?.();
      onOpenChange(false);
    }
  };

  // الحصول على الموظفين حسب القسم
  const getFilteredEmployees = () => {
    if (editType !== "activity" || !plan) return employees;
    const init = initiatives.find(i => i.name === plan.initiative);
    const goal = strategicGoals.find(g => g.name === plan.strategic_goal);
    const deptId = init?.department_id || goal?.department_id;
    if (!deptId) return employees;
    return employees.filter(e => e.department_id === deptId);
  };

  const getTitle = () => {
    switch (editType) {
      case "strategic_goal":
        return "تعديل الهدف الاستراتيجي";
      case "initiative":
        return "تعديل المبادرة";
      case "activity":
        return "تعديل النشاط";
    }
  };

  const getIcon = () => {
    switch (editType) {
      case "strategic_goal":
        return <Target className="w-5 h-5 text-primary" />;
      case "initiative":
        return <Folder className="w-5 h-5 text-blue-500" />;
      case "activity":
        return <Activity className="w-5 h-5 text-green-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {editType === "strategic_goal" && (
            <>
              <div className="space-y-2">
                <Label>اسم الهدف الاستراتيجي</Label>
                <Input
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="أدخل اسم الهدف"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <span className="text-xs">📍</span>
                  مالك الهدف (القسم)
                </Label>
                <Select value={goalDepartmentId} onValueChange={setGoalDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم المالك" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون قسم</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {editType === "initiative" && (
            <>
              <div className="space-y-2">
                <Label>اسم المبادرة</Label>
                <Input
                  value={initName}
                  onChange={(e) => setInitName(e.target.value)}
                  placeholder="أدخل اسم المبادرة"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <span className="text-xs">📍</span>
                  مالك المبادرة (القسم)
                </Label>
                <Select value={initDepartmentId} onValueChange={setInitDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم المالك" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون قسم</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {editType === "activity" && plan && (
            <>
              <div className="space-y-2">
                <Label>اسم النشاط</Label>
                <Input
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder="أدخل اسم النشاط"
                />
              </div>
              <div className="space-y-2">
                <Label>المستهدف السنوي</Label>
                <Input
                  type="number"
                  value={annualTarget}
                  onChange={(e) => setAnnualTarget(parseFloat(e.target.value) || 0)}
                  placeholder="أدخل المستهدف السنوي"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  مسؤول التنفيذ
                </Label>
                <Select value={responsibleEmployeeId} onValueChange={setResponsibleEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مسؤول التنفيذ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مسؤول</SelectItem>
                    {getFilteredEmployees().map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getFilteredEmployees().length === 0 && (
                  <p className="text-xs text-muted-foreground">لا يوجد موظفين مسجلين في قسم مالك المبادرة</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          {editType === "activity" ? (
            <Button
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 ml-1" />
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={loading} className="gap-1">
              <Save className="w-4 h-4" />
              حفظ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
