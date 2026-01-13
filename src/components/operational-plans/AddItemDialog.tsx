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
import { Target, Folder, Activity, User, Save, X, Building2, Plus } from "lucide-react";
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
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
}

type AddType = "strategic_goal" | "initiative" | "activity";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addType: AddType;
  parentGoalName?: string;
  parentInitiativeName?: string;
  departments: Department[];
  employees: Employee[];
  year: number;
  userId: string;
  onSave: () => void;
}

export function AddItemDialog({
  open,
  onOpenChange,
  addType,
  parentGoalName,
  parentInitiativeName,
  departments,
  employees,
  year,
  userId,
  onSave,
}: AddItemDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // الهدف الاستراتيجي
  const [goalName, setGoalName] = useState("");
  const [goalDepartmentIds, setGoalDepartmentIds] = useState<string[]>([]);
  const [goalInitiativeName, setGoalInitiativeName] = useState("");
  const [goalInitDepartmentIds, setGoalInitDepartmentIds] = useState<string[]>([]);
  const [goalActivityName, setGoalActivityName] = useState("");
  const [goalActivityTarget, setGoalActivityTarget] = useState<number>(0);
  const [goalResponsibleEmployeeId, setGoalResponsibleEmployeeId] = useState<string>("none");

  // المبادرة (تحت هدف موجود)
  const [initName, setInitName] = useState("");
  const [initDepartmentIds, setInitDepartmentIds] = useState<string[]>([]);
  const [initActivityName, setInitActivityName] = useState("");
  const [initActivityTarget, setInitActivityTarget] = useState<number>(0);
  const [initResponsibleEmployeeId, setInitResponsibleEmployeeId] = useState<string>("none");

  // النشاط (تحت مبادرة موجودة)
  const [activityName, setActivityName] = useState("");
  const [activityTarget, setActivityTarget] = useState<number>(0);
  const [responsibleEmployeeId, setResponsibleEmployeeId] = useState<string>("none");

  // إعادة تعيين الحقول عند الفتح
  useEffect(() => {
    if (open) {
      setGoalName("");
      setGoalDepartmentIds([]);
      setGoalInitiativeName("");
      setGoalInitDepartmentIds([]);
      setGoalActivityName("");
      setGoalActivityTarget(0);
      setGoalResponsibleEmployeeId("none");
      setInitName("");
      setInitDepartmentIds([]);
      setInitActivityName("");
      setInitActivityTarget(0);
      setInitResponsibleEmployeeId("none");
      setActivityName("");
      setActivityTarget(0);
      setResponsibleEmployeeId("none");
    }
  }, [open]);

  const handleToggleDepartment = (deptId: string, target: "goal" | "goalInit" | "init") => {
    if (target === "goal") {
      setGoalDepartmentIds(prev => 
        prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
      );
    } else if (target === "goalInit") {
      setGoalInitDepartmentIds(prev => 
        prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
      );
    } else {
      setInitDepartmentIds(prev => 
        prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
      );
    }
  };

  // الموظفين المفلترين حسب الأقسام المختارة
  const getFilteredEmployees = (deptIds: string[]) => {
    if (deptIds.length === 0) return employees;
    return employees.filter(e => e.department_id && deptIds.includes(e.department_id));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (addType === "strategic_goal") {
        // إنشاء الهدف الاستراتيجي
        const { data: goalData, error: goalError } = await supabase
          .from("strategic_goals")
          .insert({ name: goalName, year })
          .select()
          .single();
        if (goalError) throw goalError;

        // إضافة الأقسام المالكة للهدف
        if (goalDepartmentIds.length > 0) {
          await supabase
            .from("strategic_goal_departments")
            .insert(goalDepartmentIds.map(deptId => ({
              strategic_goal_id: goalData.id,
              department_id: deptId,
            })));
        }

        // إنشاء المبادرة
        const { data: initData, error: initError } = await supabase
          .from("initiatives")
          .insert({ name: goalInitiativeName, strategic_goal_id: goalData.id })
          .select()
          .single();
        if (initError) throw initError;

        // إضافة الأقسام المالكة للمبادرة
        if (goalInitDepartmentIds.length > 0) {
          await supabase
            .from("initiative_departments")
            .insert(goalInitDepartmentIds.map(deptId => ({
              initiative_id: initData.id,
              department_id: deptId,
            })));
        }

        // إنشاء الخطة التشغيلية (النشاط)
        const { error: planError } = await supabase
          .from("operational_plans")
          .insert({
            user_id: userId,
            strategic_goal: goalName,
            strategic_goal_id: goalData.id,
            initiative: goalInitiativeName,
            initiative_id: initData.id,
            activity_name: goalActivityName,
            annual_target: goalActivityTarget,
            year,
            responsible_employee_id: goalResponsibleEmployeeId === "none" ? null : goalResponsibleEmployeeId,
          });
        if (planError) throw planError;

        toast({ title: "تم بنجاح", description: "تم إضافة الهدف الاستراتيجي والمبادرة والنشاط" });

      } else if (addType === "initiative") {
        // البحث عن الهدف الاستراتيجي
        const { data: goalData } = await supabase
          .from("strategic_goals")
          .select("id")
          .eq("name", parentGoalName)
          .single();

        // إنشاء المبادرة
        const { data: initData, error: initError } = await supabase
          .from("initiatives")
          .insert({ 
            name: initName, 
            strategic_goal_id: goalData?.id || null 
          })
          .select()
          .single();
        if (initError) throw initError;

        // إضافة الأقسام المالكة للمبادرة
        if (initDepartmentIds.length > 0) {
          await supabase
            .from("initiative_departments")
            .insert(initDepartmentIds.map(deptId => ({
              initiative_id: initData.id,
              department_id: deptId,
            })));
        }

        // إنشاء الخطة التشغيلية (النشاط)
        const { error: planError } = await supabase
          .from("operational_plans")
          .insert({
            user_id: userId,
            strategic_goal: parentGoalName,
            strategic_goal_id: goalData?.id || null,
            initiative: initName,
            initiative_id: initData.id,
            activity_name: initActivityName,
            annual_target: initActivityTarget,
            year,
            responsible_employee_id: initResponsibleEmployeeId === "none" ? null : initResponsibleEmployeeId,
          });
        if (planError) throw planError;

        toast({ title: "تم بنجاح", description: "تم إضافة المبادرة والنشاط" });

      } else if (addType === "activity") {
        // البحث عن الهدف والمبادرة
        const { data: goalData } = await supabase
          .from("strategic_goals")
          .select("id")
          .eq("name", parentGoalName)
          .single();

        const { data: initData } = await supabase
          .from("initiatives")
          .select("id")
          .eq("name", parentInitiativeName)
          .single();

        // إنشاء الخطة التشغيلية (النشاط)
        const { error: planError } = await supabase
          .from("operational_plans")
          .insert({
            user_id: userId,
            strategic_goal: parentGoalName,
            strategic_goal_id: goalData?.id || null,
            initiative: parentInitiativeName,
            initiative_id: initData?.id || null,
            activity_name: activityName,
            annual_target: activityTarget,
            year,
            responsible_employee_id: responsibleEmployeeId === "none" ? null : responsibleEmployeeId,
          });
        if (planError) throw planError;

        toast({ title: "تم بنجاح", description: "تم إضافة النشاط" });
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في الإضافة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (addType) {
      case "strategic_goal":
        return "إضافة هدف استراتيجي جديد";
      case "initiative":
        return `إضافة مبادرة جديدة تحت "${parentGoalName}"`;
      case "activity":
        return `إضافة نشاط جديد تحت "${parentInitiativeName}"`;
    }
  };

  const getIcon = () => {
    switch (addType) {
      case "strategic_goal":
        return <Target className="w-5 h-5 text-purple-500" />;
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
      <Label className="flex items-center gap-1 text-sm">
        <Building2 className="w-4 h-4" />
        {label}
      </Label>
      <div className="border rounded-lg p-3 bg-muted/30">
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedIds.map(deptId => {
              const dept = departments.find(d => d.id === deptId);
              return dept ? (
                <Badge 
                  key={deptId} 
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                  onClick={() => onToggle(deptId)}
                >
                  {dept.name}
                  <X className="w-3 h-3" />
                </Badge>
              ) : null;
            })}
          </div>
        )}
        <ScrollArea className="h-24">
          <div className="space-y-1">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-2">
                <Checkbox
                  id={`dept-add-${dept.id}`}
                  checked={selectedIds.includes(dept.id)}
                  onCheckedChange={() => onToggle(dept.id)}
                />
                <label
                  htmlFor={`dept-add-${dept.id}`}
                  className="text-xs font-medium cursor-pointer"
                >
                  {dept.name}
                </label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  const EmployeeSelector = ({
    value,
    onChange,
    deptIds,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    deptIds: string[];
    label: string;
  }) => {
    const filtered = getFilteredEmployees(deptIds);
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1 text-sm">
          <User className="w-4 h-4" />
          {label}
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="اختر مسؤول التنفيذ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون مسؤول</SelectItem>
            {filtered.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered.length === 0 && deptIds.length > 0 && (
          <p className="text-xs text-muted-foreground">لا يوجد موظفين في الأقسام المحددة</p>
        )}
      </div>
    );
  };

  const canSave = () => {
    if (addType === "strategic_goal") {
      return goalName.trim() && goalInitiativeName.trim() && goalActivityName.trim();
    } else if (addType === "initiative") {
      return initName.trim() && initActivityName.trim();
    } else {
      return activityName.trim();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {addType === "strategic_goal" && (
            <>
              {/* الهدف الاستراتيجي */}
              <div className="p-3 rounded-lg border bg-purple-50/50 space-y-3">
                <div className="flex items-center gap-2 text-purple-700 font-medium text-sm">
                  <Target className="w-4 h-4" />
                  الهدف الاستراتيجي
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">اسم الهدف</Label>
                  <Input
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    placeholder="أدخل اسم الهدف الاستراتيجي"
                  />
                </div>
                <DepartmentSelector
                  selectedIds={goalDepartmentIds}
                  onToggle={(id) => handleToggleDepartment(id, "goal")}
                  label="الأقسام المالكة (يمكن اختيار أكثر من قسم)"
                />
              </div>

              {/* المبادرة */}
              <div className="p-3 rounded-lg border bg-blue-50/50 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                  <Folder className="w-4 h-4" />
                  المبادرة
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">اسم المبادرة</Label>
                  <Input
                    value={goalInitiativeName}
                    onChange={(e) => setGoalInitiativeName(e.target.value)}
                    placeholder="أدخل اسم المبادرة"
                  />
                </div>
                <DepartmentSelector
                  selectedIds={goalInitDepartmentIds}
                  onToggle={(id) => handleToggleDepartment(id, "goalInit")}
                  label="الأقسام المالكة (يمكن اختيار أكثر من قسم)"
                />
              </div>

              {/* النشاط */}
              <div className="p-3 rounded-lg border bg-green-50/50 space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <Activity className="w-4 h-4" />
                  النشاط
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-sm">اسم النشاط</Label>
                    <Input
                      value={goalActivityName}
                      onChange={(e) => setGoalActivityName(e.target.value)}
                      placeholder="اسم النشاط"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">المستهدف السنوي</Label>
                    <Input
                      type="number"
                      value={goalActivityTarget}
                      onChange={(e) => setGoalActivityTarget(parseInt(e.target.value) || 0)}
                      placeholder="المستهدف"
                    />
                  </div>
                </div>
                <EmployeeSelector
                  value={goalResponsibleEmployeeId}
                  onChange={setGoalResponsibleEmployeeId}
                  deptIds={[...goalDepartmentIds, ...goalInitDepartmentIds]}
                  label="مسؤول التنفيذ (مالك واحد فقط)"
                />
              </div>
            </>
          )}

          {addType === "initiative" && (
            <>
              {/* المبادرة */}
              <div className="p-3 rounded-lg border bg-blue-50/50 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                  <Folder className="w-4 h-4" />
                  المبادرة
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">اسم المبادرة</Label>
                  <Input
                    value={initName}
                    onChange={(e) => setInitName(e.target.value)}
                    placeholder="أدخل اسم المبادرة"
                  />
                </div>
                <DepartmentSelector
                  selectedIds={initDepartmentIds}
                  onToggle={(id) => handleToggleDepartment(id, "init")}
                  label="الأقسام المالكة (يمكن اختيار أكثر من قسم)"
                />
              </div>

              {/* النشاط */}
              <div className="p-3 rounded-lg border bg-green-50/50 space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <Activity className="w-4 h-4" />
                  النشاط
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-sm">اسم النشاط</Label>
                    <Input
                      value={initActivityName}
                      onChange={(e) => setInitActivityName(e.target.value)}
                      placeholder="اسم النشاط"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">المستهدف السنوي</Label>
                    <Input
                      type="number"
                      value={initActivityTarget}
                      onChange={(e) => setInitActivityTarget(parseInt(e.target.value) || 0)}
                      placeholder="المستهدف"
                    />
                  </div>
                </div>
                <EmployeeSelector
                  value={initResponsibleEmployeeId}
                  onChange={setInitResponsibleEmployeeId}
                  deptIds={initDepartmentIds}
                  label="مسؤول التنفيذ (مالك واحد فقط)"
                />
              </div>
            </>
          )}

          {addType === "activity" && (
            <div className="p-3 rounded-lg border bg-green-50/50 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <Activity className="w-4 h-4" />
                النشاط
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-sm">اسم النشاط</Label>
                  <Input
                    value={activityName}
                    onChange={(e) => setActivityName(e.target.value)}
                    placeholder="اسم النشاط"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">المستهدف السنوي</Label>
                  <Input
                    type="number"
                    value={activityTarget}
                    onChange={(e) => setActivityTarget(parseInt(e.target.value) || 0)}
                    placeholder="المستهدف"
                  />
                </div>
              </div>
              <EmployeeSelector
                value={responsibleEmployeeId}
                onChange={setResponsibleEmployeeId}
                deptIds={[]}
                label="مسؤول التنفيذ (مالك واحد فقط)"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 ml-1" />
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={loading || !canSave()} className="gap-1">
            <Plus className="w-4 h-4" />
            إضافة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}