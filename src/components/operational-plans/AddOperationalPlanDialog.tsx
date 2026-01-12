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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Target, 
  Lightbulb, 
  Activity, 
  Calendar,
  Check,
  Plus,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

interface AddOperationalPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  employees: Employee[];
  strategicGoals: StrategicGoal[];
  initiatives: Initiative[];
  onSubmit: (data: {
    selectedEmployeeId: string;
    selectedGoalId: string;
    selectedInitiativeId: string;
    isAddingNewGoal: boolean;
    isAddingNewInitiative: boolean;
    newGoalName: string;
    newInitiativeName: string;
    activityName: string;
    annualTarget: string;
    year: number;
    monthlyTargets: number[];
  }) => void;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const steps = [
  { id: 1, title: "الهدف الاستراتيجي", icon: Target, description: "اختر أو أضف هدفاً" },
  { id: 2, title: "المبادرة", icon: Lightbulb, description: "حدد المبادرة" },
  { id: 3, title: "النشاط", icon: Activity, description: "تفاصيل النشاط" },
  { id: 4, title: "المستهدفات", icon: Calendar, description: "التوزيع الشهري" },
];

export function AddOperationalPlanDialog({
  open,
  onOpenChange,
  isAdmin,
  employees,
  strategicGoals,
  initiatives,
  onSubmit,
}: AddOperationalPlanDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [selectedInitiativeId, setSelectedInitiativeId] = useState("");
  const [isAddingNewGoal, setIsAddingNewGoal] = useState(false);
  const [isAddingNewInitiative, setIsAddingNewInitiative] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newInitiativeName, setNewInitiativeName] = useState("");
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(Array(12).fill(0));

  const filteredInitiatives = initiatives.filter(
    (init) => init.strategic_goal_id === selectedGoalId
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setSelectedEmployeeId("");
      setSelectedGoalId("");
      setSelectedInitiativeId("");
      setIsAddingNewGoal(false);
      setIsAddingNewInitiative(false);
      setNewGoalName("");
      setNewInitiativeName("");
      setActivityName("");
      setAnnualTarget("");
      setYear(new Date().getFullYear());
      setMonthlyTargets(Array(12).fill(0));
    }
  }, [open]);

  const handleAnnualTargetChange = (value: string) => {
    setAnnualTarget(value);
    const target = parseInt(value) || 0;
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    const newTargets = Array(12).fill(perMonth);
    for (let i = 11; i >= 12 - remainder; i--) {
      newTargets[i]++;
    }
    setMonthlyTargets(newTargets);
  };

  const handleMonthlyTargetChange = (monthIndex: number, value: string) => {
    const newTargets = [...monthlyTargets];
    newTargets[monthIndex] = parseInt(value) || 0;
    setMonthlyTargets(newTargets);
  };

  const getTotalMonthlyTargets = () => {
    return monthlyTargets.reduce((sum, t) => sum + t, 0);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (isAdmin && !selectedEmployeeId) return false;
        return isAddingNewGoal ? newGoalName.trim().length > 0 : selectedGoalId.length > 0;
      case 2:
        return isAddingNewInitiative ? newInitiativeName.trim().length > 0 : selectedInitiativeId.length > 0;
      case 3:
        return activityName.trim().length > 0 && parseInt(annualTarget) > 0;
      case 4:
        return getTotalMonthlyTargets() === parseInt(annualTarget || "0");
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      selectedEmployeeId,
      selectedGoalId,
      selectedInitiativeId,
      isAddingNewGoal,
      isAddingNewInitiative,
      newGoalName,
      newInitiativeName,
      activityName,
      annualTarget,
      year,
      monthlyTargets,
    });
  };

  const getSelectedGoalName = () => {
    if (isAddingNewGoal) return newGoalName;
    return strategicGoals.find(g => g.id === selectedGoalId)?.name || "";
  };

  const getSelectedInitiativeName = () => {
    if (isAddingNewInitiative) return newInitiativeName;
    return filteredInitiatives.find(i => i.id === selectedInitiativeId)?.name || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header with gradient */}
          <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-6 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">إضافة خطة تشغيلية جديدة</DialogTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    قم بإنشاء خطة تشغيلية متكاملة خطوة بخطوة
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Stepper */}
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                        currentStep > step.id
                          ? "bg-primary text-primary-foreground"
                          : currentStep === step.id
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-2 font-medium text-center",
                        currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "h-1 flex-1 mx-2 rounded-full transition-all duration-300",
                        currentStep > step.id ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Step 1: Strategic Goal */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    {/* Employee Selection for Admin */}
                    {isAdmin && (
                      <Card className="p-4 border-dashed">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-500" />
                          </div>
                          <Label className="text-base font-semibold">اختر الموظف</Label>
                        </div>
                        <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر الموظف المسؤول عن الخطة" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.user_id}>
                                {emp.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Card>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">الهدف الاستراتيجي</h3>
                          <p className="text-sm text-muted-foreground">اختر من القائمة أو أضف هدفاً جديداً</p>
                        </div>
                      </div>
                      <Button
                        variant={isAddingNewGoal ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setIsAddingNewGoal(!isAddingNewGoal);
                          if (!isAddingNewGoal) {
                            setSelectedGoalId("");
                          } else {
                            setNewGoalName("");
                          }
                        }}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {isAddingNewGoal ? "اختيار من القائمة" : "هدف جديد"}
                      </Button>
                    </div>

                    {isAddingNewGoal ? (
                      <div className="space-y-2">
                        <Label>اسم الهدف الجديد</Label>
                        <Input
                          value={newGoalName}
                          onChange={(e) => setNewGoalName(e.target.value)}
                          placeholder="مثال: تحسين تجربة العملاء"
                          className="text-lg h-12"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {strategicGoals.length === 0 ? (
                          <Card className="p-8 text-center border-dashed">
                            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">لا توجد أهداف استراتيجية</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => setIsAddingNewGoal(true)}
                            >
                              <Plus className="w-4 h-4 ml-2" />
                              أضف هدفاً جديداً
                            </Button>
                          </Card>
                        ) : (
                          strategicGoals.map((goal) => (
                            <Card
                              key={goal.id}
                              className={cn(
                                "p-4 cursor-pointer transition-all duration-200 hover:shadow-md",
                                selectedGoalId === goal.id
                                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                  : "hover:border-primary/50"
                              )}
                              onClick={() => {
                                setSelectedGoalId(goal.id);
                                setSelectedInitiativeId("");
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-10 rounded-full"
                                  style={{ backgroundColor: goal.color || "hsl(var(--primary))" }}
                                />
                                <div className="flex-1">
                                  <h4 className="font-medium">{goal.name}</h4>
                                  <p className="text-sm text-muted-foreground">سنة {goal.year}</p>
                                </div>
                                {selectedGoalId === goal.id && (
                                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="w-4 h-4 text-primary-foreground" />
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Initiative */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {/* Selected Goal Summary */}
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Target className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">الهدف الاستراتيجي</p>
                          <p className="font-medium">{getSelectedGoalName()}</p>
                        </div>
                      </div>
                    </Card>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <Lightbulb className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold">المبادرة</h3>
                          <p className="text-sm text-muted-foreground">حدد المبادرة التي يندرج تحتها النشاط</p>
                        </div>
                      </div>
                      <Button
                        variant={isAddingNewInitiative ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setIsAddingNewInitiative(!isAddingNewInitiative);
                          if (!isAddingNewInitiative) {
                            setSelectedInitiativeId("");
                          } else {
                            setNewInitiativeName("");
                          }
                        }}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {isAddingNewInitiative ? "اختيار من القائمة" : "مبادرة جديدة"}
                      </Button>
                    </div>

                    {isAddingNewInitiative ? (
                      <div className="space-y-2">
                        <Label>اسم المبادرة الجديدة</Label>
                        <Input
                          value={newInitiativeName}
                          onChange={(e) => setNewInitiativeName(e.target.value)}
                          placeholder="مثال: برنامج ولاء العملاء"
                          className="text-lg h-12"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {filteredInitiatives.length === 0 ? (
                          <Card className="p-8 text-center border-dashed">
                            <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">لا توجد مبادرات لهذا الهدف</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => setIsAddingNewInitiative(true)}
                            >
                              <Plus className="w-4 h-4 ml-2" />
                              أضف مبادرة جديدة
                            </Button>
                          </Card>
                        ) : (
                          filteredInitiatives.map((initiative) => (
                            <Card
                              key={initiative.id}
                              className={cn(
                                "p-4 cursor-pointer transition-all duration-200 hover:shadow-md",
                                selectedInitiativeId === initiative.id
                                  ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20"
                                  : "hover:border-amber-500/50"
                              )}
                              onClick={() => setSelectedInitiativeId(initiative.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-8 rounded-full bg-amber-500" />
                                <div className="flex-1">
                                  <h4 className="font-medium">{initiative.name}</h4>
                                </div>
                                {selectedInitiativeId === initiative.id && (
                                  <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Activity */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-3 bg-primary/5 border-primary/20">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">الهدف</p>
                            <p className="text-sm font-medium truncate">{getSelectedGoalName()}</p>
                          </div>
                        </div>
                      </Card>
                      <Card className="p-3 bg-amber-500/5 border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">المبادرة</p>
                            <p className="text-sm font-medium truncate">{getSelectedInitiativeName()}</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold">تفاصيل النشاط</h3>
                        <p className="text-sm text-muted-foreground">أدخل معلومات النشاط والمستهدف السنوي</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>اسم النشاط <span className="text-destructive">*</span></Label>
                        <Input
                          value={activityName}
                          onChange={(e) => setActivityName(e.target.value)}
                          placeholder="مثال: حملة التسويق الرقمي"
                          className="text-lg h-12"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>المستهدف السنوي <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            value={annualTarget}
                            onChange={(e) => handleAnnualTargetChange(e.target.value)}
                            placeholder="0"
                            className="text-lg h-12"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>السنة</Label>
                          <Input
                            type="number"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="text-lg h-12"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Monthly Targets */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="p-3 bg-primary/5 border-primary/20">
                        <p className="text-xs text-muted-foreground">الهدف</p>
                        <p className="text-sm font-medium truncate">{getSelectedGoalName()}</p>
                      </Card>
                      <Card className="p-3 bg-amber-500/5 border-amber-500/20">
                        <p className="text-xs text-muted-foreground">المبادرة</p>
                        <p className="text-sm font-medium truncate">{getSelectedInitiativeName()}</p>
                      </Card>
                      <Card className="p-3 bg-emerald-500/5 border-emerald-500/20">
                        <p className="text-xs text-muted-foreground">النشاط</p>
                        <p className="text-sm font-medium truncate">{activityName}</p>
                      </Card>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold">توزيع المستهدفات الشهرية</h3>
                          <p className="text-sm text-muted-foreground">وزّع المستهدف السنوي على الأشهر</p>
                        </div>
                      </div>
                      <Badge
                        variant={getTotalMonthlyTargets() === parseInt(annualTarget || "0") ? "default" : "destructive"}
                        className="text-sm px-3 py-1"
                      >
                        <span style={{ fontFamily: 'Arial, sans-serif' }}>
                          {formatNumber(getTotalMonthlyTargets())} / {formatNumber(annualTarget || 0)}
                        </span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {MONTHS_AR.map((month, index) => (
                        <Card
                          key={index}
                          className={cn(
                            "p-3 transition-all",
                            monthlyTargets[index] > 0 ? "border-primary/30 bg-primary/5" : ""
                          )}
                        >
                          <Label className="text-xs text-muted-foreground">{month}</Label>
                          <Input
                            type="number"
                            value={monthlyTargets[index]}
                            onChange={(e) => handleMonthlyTargetChange(index, e.target.value)}
                            className="mt-1 text-center h-10"
                          />
                        </Card>
                      ))}
                    </div>

                    {getTotalMonthlyTargets() !== parseInt(annualTarget || "0") && (
                      <Card className="p-3 bg-destructive/10 border-destructive/30">
                        <p className="text-sm text-destructive text-center">
                          ⚠️ مجموع الأشهر لا يساوي المستهدف السنوي
                        </p>
                      </Card>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t p-4 bg-muted/30 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              السابق
            </Button>
            
            <div className="flex items-center gap-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    currentStep >= step.id ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="gap-2"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed()}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80"
              >
                <Sparkles className="w-4 h-4" />
                إنشاء الخطة
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
