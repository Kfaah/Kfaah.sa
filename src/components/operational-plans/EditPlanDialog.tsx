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
import { Checkbox } from "@/components/ui/checkbox";
import { Target, Folder, Activity, User, Trash2, Save, X, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  departments?: Department[];
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
  department_id: string | null;
  department_name?: string;
  departments?: Department[];
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
  const [goalDepartmentIds, setGoalDepartmentIds] = useState<string[]>([]);

  // المبادرة
  const [initName, setInitName] = useState("");
  const [initDepartmentIds, setInitDepartmentIds] = useState<string[]>([]);

  // النشاط
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState<number>(0);
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<string>("none");

  // تحميل الأقسام المرتبطة
  const loadGoalDepartments = async (goalId: string) => {
    const { data } = await supabase
      .from("strategic_goal_departments")
      .select("department_id")
      .eq("strategic_goal_id", goalId);
    if (data) {
      setGoalDepartmentIds(data.map(d => d.department_id));
    }
  };

  const loadInitDepartments = async (initId: string) => {
    const { data } = await supabase
      .from("initiative_departments")
      .select("department_id")
      .eq("initiative_id", initId);
    if (data) {
      setInitDepartmentIds(data.map(d => d.department_id));
    }
  };

  useEffect(() => {
    if (open) {
      if (editType === "strategic_goal" && strategicGoalName) {
        const goal = strategicGoals.find(g => g.name === strategicGoalName);
        setGoalName(strategicGoalName);
        setGoalDepartmentIds([]);
        if (goal) {
          loadGoalDepartments(goal.id);
        }
      } else if (editType === "initiative" && initiativeName) {
        const init = initiatives.find(i => i.name === initiativeName);
        setInitName(initiativeName);
        setInitDepartmentIds([]);
        if (init) {
          loadInitDepartments(init.id);
        }
      } else if (editType === "activity" && plan) {
        setActivityName(plan.activity_name);
        setAnnualTarget(plan.annual_target);
        setResponsibleEmployeeId(plan.responsible_employee_id || "none");
      }
    }
  }, [open, editType, plan, strategicGoalName, initiativeName, strategicGoals, initiatives]);

  const handleToggleDepartment = (deptId: string, type: "goal" | "init") => {
    if (type === "goal") {
      setGoalDepartmentIds(prev => 
        prev.includes(deptId) 
          ? prev.filter(id => id !== deptId)
          : [...prev, deptId]
      );
    } else {
      setInitDepartmentIds(prev => 
        prev.includes(deptId) 
          ? prev.filter(id => id !== deptId)
          : [...prev, deptId]
      );
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editType === "strategic_goal") {
        const goal = strategicGoals.find(g => g.name === strategicGoalName);
        console.log("Editing strategic goal:", { strategicGoalName, goal, goalName, goalDepartmentIds });
        
        if (!goal) {
          toast({
            title: "خطأ",
            description: "لم يتم العثور على الهدف الاستراتيجي",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        // تحديث اسم الهدف
        const { error } = await supabase
          .from("strategic_goals")
          .update({ name: goalName })
          .eq("id", goal.id);
        if (error) throw error;

        // حذف الأقسام القديمة وإضافة الجديدة
        const { error: deleteError } = await supabase
          .from("strategic_goal_departments")
          .delete()
          .eq("strategic_goal_id", goal.id);
        
        if (deleteError) {
          console.log("Delete error (may be normal if no existing records):", deleteError);
        }

        if (goalDepartmentIds.length > 0) {
          const { error: insertError } = await supabase
            .from("strategic_goal_departments")
            .insert(
              goalDepartmentIds.map(deptId => ({
                strategic_goal_id: goal.id,
                department_id: deptId,
              }))
            );
          if (insertError) throw insertError;
        }

        // تحديث اسم الهدف في الخطط
        if (goalName !== strategicGoalName) {
          await supabase
            .from("operational_plans")
            .update({ strategic_goal: goalName })
            .eq("strategic_goal", strategicGoalName);
        }
        toast({ title: "تم الحفظ", description: "تم تحديث الهدف الاستراتيجي" });
      } else if (editType === "initiative") {
        const init = initiatives.find(i => i.name === initiativeName);
        if (init) {
          // تحديث اسم المبادرة
          const { error } = await supabase
            .from("initiatives")
            .update({ name: initName })
            .eq("id", init.id);
          if (error) throw error;

          // حذف الأقسام القديمة وإضافة الجديدة
          await supabase
            .from("initiative_departments")
            .delete()
            .eq("initiative_id", init.id);

          if (initDepartmentIds.length > 0) {
            const { error: insertError } = await supabase
              .from("initiative_departments")
              .insert(
                initDepartmentIds.map(deptId => ({
                  initiative_id: init.id,
                  department_id: deptId,
                }))
              );
            if (insertError) throw insertError;
          }

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

  // الحصول على الموظفين حسب الأقسام المالكة
  const getFilteredEmployees = () => {
    if (editType !== "activity" || !plan) return employees;
    
    // الحصول على أقسام المبادرة أو الهدف
    const init = initiatives.find(i => i.name === plan.initiative);
    const goal = strategicGoals.find(g => g.name === plan.strategic_goal);
    
    // في حالة تعدد المالكين، نجمع كل الموظفين من الأقسام المالكة
    // التحقق من أن departments هي مصفوفة قبل استخدام map
    const initDepts = Array.isArray(init?.departments) 
      ? init.departments.map(d => d.id) 
      : (init?.department_id ? [init.department_id] : []);
    const goalDepts = Array.isArray(goal?.departments) 
      ? goal.departments.map(d => d.id) 
      : (goal?.department_id ? [goal.department_id] : []);
    
    const allDepts = [...new Set([...initDepts, ...goalDepts])];
    
    if (allDepts.length === 0) return employees;
    return employees.filter(e => e.department_id && allDepts.includes(e.department_id));
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

  const DepartmentSelector = ({ 
    selectedIds, 
    onToggle, 
    label 
  }: { 
    selectedIds: string[]; 
    onToggle: (id: string) => void;
    label: string;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        <Building2 className="w-4 h-4" />
        {label}
      </Label>
      <div className="border rounded-lg p-3 bg-muted/30">
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {selectedIds.map(deptId => {
              const dept = departments.find(d => d.id === deptId);
              return dept ? (
                <Badge 
                  key={deptId} 
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => onToggle(deptId)}
                >
                  {dept.name}
                  <X className="w-3 h-3" />
                </Badge>
              ) : null;
            })}
          </div>
        )}
        <ScrollArea className="h-32">
          <div className="space-y-2">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-2">
                <Checkbox
                  id={`dept-${dept.id}`}
                  checked={selectedIds.includes(dept.id)}
                  onCheckedChange={() => onToggle(dept.id)}
                />
                <label
                  htmlFor={`dept-${dept.id}`}
                  className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {dept.name}
                </label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      {selectedIds.length === 0 && (
        <p className="text-xs text-muted-foreground">لم يتم تحديد أي قسم</p>
      )}
    </div>
  );

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
              <DepartmentSelector
                selectedIds={goalDepartmentIds}
                onToggle={(id) => handleToggleDepartment(id, "goal")}
                label="الأقسام المالكة للهدف (يمكن اختيار أكثر من قسم)"
              />
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
              <DepartmentSelector
                selectedIds={initDepartmentIds}
                onToggle={(id) => handleToggleDepartment(id, "init")}
                label="الأقسام المالكة للمبادرة (يمكن اختيار أكثر من قسم)"
              />
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
                  مسؤول التنفيذ (مالك واحد فقط)
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
                  <p className="text-xs text-muted-foreground">لا يوجد موظفين مسجلين في أقسام المالكين</p>
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