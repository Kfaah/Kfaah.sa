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
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Target, 
  Lightbulb, 
  Activity, 
  Plus,
  Trash2,
  Sparkles,
  Users,
  ChevronDown,
  ChevronLeft,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
}

interface StrategicGoal {
  id: string;
  name: string;
  color: string;
  year: number;
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
}

// هيكل النشاط المحلي
interface LocalActivity {
  id: string;
  name: string;
  annualTarget: number;
}

// هيكل المبادرة المحلية
interface LocalInitiative {
  id: string;
  name: string;
  isNew: boolean;
  existingId?: string;
  activities: LocalActivity[];
}

// هيكل الهدف المحلي
interface LocalGoal {
  id: string;
  name: string;
  isNew: boolean;
  existingId?: string;
  initiatives: LocalInitiative[];
}

interface AddOperationalPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  employees: Employee[];
  strategicGoals: StrategicGoal[];
  initiatives: Initiative[];
  onSubmit: (data: {
    selectedEmployeeId: string;
    goals: LocalGoal[];
    year: number;
  }) => void;
}

export function AddOperationalPlanDialog({
  open,
  onOpenChange,
  isAdmin,
  employees,
  strategicGoals,
  initiatives,
  onSubmit,
}: AddOperationalPlanDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState<LocalGoal[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedInitiatives, setExpandedInitiatives] = useState<Set<string>>(new Set());

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId("");
      setYear(new Date().getFullYear());
      setGoals([]);
      setExpandedGoals(new Set());
      setExpandedInitiatives(new Set());
    }
  }, [open]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // إضافة هدف جديد
  const addNewGoal = () => {
    const newGoal: LocalGoal = {
      id: generateId(),
      name: "",
      isNew: true,
      initiatives: [],
    };
    setGoals([...goals, newGoal]);
    setExpandedGoals(new Set([...expandedGoals, newGoal.id]));
  };

  // إضافة هدف موجود
  const addExistingGoal = (goalId: string) => {
    const existingGoal = strategicGoals.find(g => g.id === goalId);
    if (!existingGoal) return;
    
    // تحقق من عدم الإضافة المكررة
    if (goals.some(g => g.existingId === goalId)) return;

    const newGoal: LocalGoal = {
      id: generateId(),
      name: existingGoal.name,
      isNew: false,
      existingId: goalId,
      initiatives: [],
    };
    setGoals([...goals, newGoal]);
    setExpandedGoals(new Set([...expandedGoals, newGoal.id]));
  };

  // حذف هدف
  const removeGoal = (goalId: string) => {
    setGoals(goals.filter(g => g.id !== goalId));
  };

  // تحديث اسم الهدف
  const updateGoalName = (goalId: string, name: string) => {
    setGoals(goals.map(g => g.id === goalId ? { ...g, name } : g));
  };

  // إضافة مبادرة جديدة
  const addNewInitiative = (goalId: string) => {
    const newInitiative: LocalInitiative = {
      id: generateId(),
      name: "",
      isNew: true,
      activities: [],
    };
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { ...g, initiatives: [...g.initiatives, newInitiative] }
        : g
    ));
    setExpandedInitiatives(new Set([...expandedInitiatives, newInitiative.id]));
  };

  // إضافة مبادرة موجودة
  const addExistingInitiative = (goalId: string, initiativeId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    const existingInitiative = initiatives.find(i => i.id === initiativeId);
    if (!existingInitiative) return;

    // تحقق من عدم الإضافة المكررة
    if (goal.initiatives.some(i => i.existingId === initiativeId)) return;

    const newInitiative: LocalInitiative = {
      id: generateId(),
      name: existingInitiative.name,
      isNew: false,
      existingId: initiativeId,
      activities: [],
    };
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { ...g, initiatives: [...g.initiatives, newInitiative] }
        : g
    ));
    setExpandedInitiatives(new Set([...expandedInitiatives, newInitiative.id]));
  };

  // حذف مبادرة
  const removeInitiative = (goalId: string, initiativeId: string) => {
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { ...g, initiatives: g.initiatives.filter(i => i.id !== initiativeId) }
        : g
    ));
  };

  // تحديث اسم المبادرة
  const updateInitiativeName = (goalId: string, initiativeId: string, name: string) => {
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { ...g, initiatives: g.initiatives.map(i => i.id === initiativeId ? { ...i, name } : i) }
        : g
    ));
  };

  // إضافة نشاط
  const addActivity = (goalId: string, initiativeId: string) => {
    const newActivity: LocalActivity = {
      id: generateId(),
      name: "",
      annualTarget: 0,
    };
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { 
            ...g, 
            initiatives: g.initiatives.map(i => 
              i.id === initiativeId 
                ? { ...i, activities: [...i.activities, newActivity] }
                : i
            ) 
          }
        : g
    ));
  };

  // حذف نشاط
  const removeActivity = (goalId: string, initiativeId: string, activityId: string) => {
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { 
            ...g, 
            initiatives: g.initiatives.map(i => 
              i.id === initiativeId 
                ? { ...i, activities: i.activities.filter(a => a.id !== activityId) }
                : i
            ) 
          }
        : g
    ));
  };

  // تحديث النشاط
  const updateActivity = (goalId: string, initiativeId: string, activityId: string, updates: Partial<LocalActivity>) => {
    setGoals(goals.map(g => 
      g.id === goalId 
        ? { 
            ...g, 
            initiatives: g.initiatives.map(i => 
              i.id === initiativeId 
                ? { ...i, activities: i.activities.map(a => a.id === activityId ? { ...a, ...updates } : a) }
                : i
            ) 
          }
        : g
    ));
  };

  // Toggle expand/collapse
  const toggleGoal = (goalId: string) => {
    const newExpanded = new Set(expandedGoals);
    if (newExpanded.has(goalId)) {
      newExpanded.delete(goalId);
    } else {
      newExpanded.add(goalId);
    }
    setExpandedGoals(newExpanded);
  };

  const toggleInitiative = (initiativeId: string) => {
    const newExpanded = new Set(expandedInitiatives);
    if (newExpanded.has(initiativeId)) {
      newExpanded.delete(initiativeId);
    } else {
      newExpanded.add(initiativeId);
    }
    setExpandedInitiatives(newExpanded);
  };

  // حساب إجمالي الأنشطة
  const getTotalActivities = () => {
    return goals.reduce((sum, g) => 
      sum + g.initiatives.reduce((iSum, i) => iSum + i.activities.length, 0), 0
    );
  };

  // التحقق من صحة البيانات
  const canSubmit = () => {
    if (isAdmin && !selectedEmployeeId) return false;
    if (goals.length === 0) return false;
    
    // تحقق من وجود نشاط واحد على الأقل مع اسم ومستهدف
    const hasValidActivity = goals.some(g => 
      g.name.trim() && g.initiatives.some(i => 
        i.name.trim() && i.activities.some(a => 
          a.name.trim() && a.annualTarget > 0
        )
      )
    );
    
    return hasValidActivity;
  };

  const handleSubmit = () => {
    onSubmit({
      selectedEmployeeId,
      goals,
      year,
    });
  };

  // المبادرات المتاحة للهدف المحدد
  const getAvailableInitiatives = (goalExistingId?: string) => {
    if (!goalExistingId) return [];
    return initiatives.filter(i => i.strategic_goal_id === goalExistingId);
  };

  // الأهداف غير المضافة
  const getAvailableGoals = () => {
    const addedGoalIds = goals.filter(g => !g.isNew).map(g => g.existingId);
    return strategicGoals.filter(g => !addedGoalIds.includes(g.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-6 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl">إضافة خطط تشغيلية</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    أضف الأهداف والمبادرات والأنشطة بشكل هرمي
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Label>السنة:</Label>
                    <Input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="w-24 h-8"
                    />
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Employee Selection for Admin */}
          {isAdmin && (
            <div className="px-6 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-muted-foreground" />
                <Label className="font-medium">الموظف:</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="اختر الموظف المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.user_id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-muted/50 border-b text-sm font-medium">
            <div className="col-span-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              الهدف الاستراتيجي
            </div>
            <div className="col-span-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              المبادرة
            </div>
            <div className="col-span-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              النشاط
            </div>
            <div className="col-span-1 text-center">السنوي</div>
            <div className="col-span-1 text-center">الشهري</div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 px-6">
            <div className="py-4 space-y-3">
              {goals.map((goal) => (
                <Card key={goal.id} className="overflow-hidden border-r-4 border-r-primary">
                  {/* Goal Row */}
                  <div className="grid grid-cols-12 gap-2 p-3 bg-primary/5 items-center">
                    <div className="col-span-4 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleGoal(goal.id)}
                      >
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform",
                          !expandedGoals.has(goal.id) && "-rotate-90"
                        )} />
                      </Button>
                      {goal.isNew ? (
                        <Input
                          value={goal.name}
                          onChange={(e) => updateGoalName(goal.id, e.target.value)}
                          placeholder="اسم الهدف الاستراتيجي..."
                          className="h-8 bg-background"
                        />
                      ) : (
                        <span className="font-medium text-primary">{goal.name}</span>
                      )}
                    </div>
                    <div className="col-span-7" />
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeGoal(goal.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Initiatives */}
                  {expandedGoals.has(goal.id) && (
                    <div className="border-t">
                      {goal.initiatives.map((initiative) => (
                        <div key={initiative.id} className="border-b last:border-b-0">
                          {/* Initiative Row */}
                          <div className="grid grid-cols-12 gap-2 p-3 pr-10 bg-amber-500/5 items-center">
                            <div className="col-span-4" />
                            <div className="col-span-3 flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleInitiative(initiative.id)}
                              >
                                <ChevronDown className={cn(
                                  "w-4 h-4 transition-transform",
                                  !expandedInitiatives.has(initiative.id) && "-rotate-90"
                                )} />
                              </Button>
                              {initiative.isNew ? (
                                <Input
                                  value={initiative.name}
                                  onChange={(e) => updateInitiativeName(goal.id, initiative.id, e.target.value)}
                                  placeholder="اسم المبادرة..."
                                  className="h-8 bg-background"
                                />
                              ) : (
                                <span className="font-medium text-amber-700">{initiative.name}</span>
                              )}
                            </div>
                            <div className="col-span-4" />
                            <div className="col-span-1 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => removeInitiative(goal.id, initiative.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Activities */}
                          {expandedInitiatives.has(initiative.id) && (
                            <div className="bg-background">
                              {initiative.activities.map((activity) => (
                                <div 
                                  key={activity.id} 
                                  className="grid grid-cols-12 gap-2 p-3 pr-16 border-t items-center hover:bg-muted/30"
                                >
                                  <div className="col-span-4" />
                                  <div className="col-span-3" />
                                  <div className="col-span-3">
                                    <Input
                                      value={activity.name}
                                      onChange={(e) => updateActivity(goal.id, initiative.id, activity.id, { name: e.target.value })}
                                      placeholder="اسم النشاط..."
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <Input
                                      type="number"
                                      value={activity.annualTarget || ""}
                                      onChange={(e) => updateActivity(goal.id, initiative.id, activity.id, { annualTarget: parseInt(e.target.value) || 0 })}
                                      placeholder="0"
                                      className="h-8 text-center"
                                    />
                                  </div>
                                  <div className="col-span-1 flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground font-mono">
                                      {activity.annualTarget ? Math.round(activity.annualTarget / 12) : 0}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                      onClick={() => removeActivity(goal.id, initiative.id, activity.id)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Add Activity Button */}
                              <div className="p-2 pr-16 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 mr-auto"
                                  onClick={() => addActivity(goal.id, initiative.id)}
                                >
                                  <Plus className="w-3 h-3 ml-1" />
                                  إضافة نشاط
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add Initiative Buttons */}
                      <div className="p-2 pr-10 flex gap-2 border-t bg-muted/20">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => addNewInitiative(goal.id)}
                        >
                          <Plus className="w-3 h-3 ml-1" />
                          مبادرة جديدة
                        </Button>
                        {!goal.isNew && getAvailableInitiatives(goal.existingId).length > 0 && (
                          <Select onValueChange={(id) => addExistingInitiative(goal.id, id)}>
                            <SelectTrigger className="h-7 w-48 text-xs">
                              <SelectValue placeholder="اختر مبادرة موجودة" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableInitiatives(goal.existingId).map((init) => (
                                <SelectItem key={init.id} value={init.id}>
                                  {init.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              {/* Add Goal Buttons */}
              <Card className="p-4 border-dashed border-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={addNewGoal}
                  >
                    <Plus className="w-4 h-4" />
                    هدف استراتيجي جديد
                  </Button>
                  
                  {getAvailableGoals().length > 0 && (
                    <>
                      <span className="text-muted-foreground text-sm">أو</span>
                      <Select onValueChange={addExistingGoal}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="اختر هدفاً موجوداً" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableGoals().map((goal) => (
                            <SelectItem key={goal.id} value={goal.id}>
                              {goal.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </Card>

              {goals.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>ابدأ بإضافة هدف استراتيجي</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-4 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>الأهداف: <strong className="text-foreground">{goals.length}</strong></span>
              <span>المبادرات: <strong className="text-foreground">{goals.reduce((s, g) => s + g.initiatives.length, 0)}</strong></span>
              <span>الأنشطة: <strong className="text-foreground">{getTotalActivities()}</strong></span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit()}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80"
              >
                <Save className="w-4 h-4" />
                حفظ الخطط ({getTotalActivities()})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
