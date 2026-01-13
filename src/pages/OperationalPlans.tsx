import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Calendar, TrendingUp, ChevronDown, ChevronUp, Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { AddOperationalPlanDialog } from "@/components/operational-plans/AddOperationalPlanDialog";
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
  months?: OperationalPlanMonth[];
  employee_name?: string;
}

interface OperationalPlanMonth {
  id: string;
  operational_plan_id: string;
  month: number;
  monthly_target: number;
}

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

// ألوان مميزة لكل هدف استراتيجي
const GOAL_COLORS = [
  { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700" },
  { bg: "bg-amber-50", border: "border-l-amber-500", text: "text-amber-700" },
  { bg: "bg-purple-50", border: "border-l-purple-500", text: "text-purple-700" },
  { bg: "bg-rose-50", border: "border-l-rose-500", text: "text-rose-700" },
  { bg: "bg-cyan-50", border: "border-l-cyan-500", text: "text-cyan-700" },
  { bg: "bg-orange-50", border: "border-l-orange-500", text: "text-orange-700" },
  { bg: "bg-indigo-50", border: "border-l-indigo-500", text: "text-indigo-700" },
];

interface GroupedPlans {
  strategicGoal: string;
  colorIndex: number;
  initiatives: {
    initiative: string;
    plans: OperationalPlan[];
  }[];
}

export default function OperationalPlans() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { user, previewAsEmployee } = useUser();
  const { toast } = useToast();
  const [plans, setPlans] = useState<OperationalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // وضع التعديل الشامل
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    activity_name: string;
    annual_target: number;
    strategic_goal: string;
    initiative: string;
  } | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [editingMonthlyTargets, setEditingMonthlyTargets] = useState<{ [planId: string]: number[] }>({});
  const [isEditingMonths, setIsEditingMonths] = useState<string | null>(null);
  
  // إضافة نشاط جديد مباشرة
  const [addingActivityUnder, setAddingActivityUnder] = useState<{
    strategicGoal: string;
    initiative: string;
    userId: string;
  } | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityTarget, setNewActivityTarget] = useState("");
  
  // إضافة مبادرة جديدة مباشرة
  const [addingInitiativeUnder, setAddingInitiativeUnder] = useState<string | null>(null);
  const [newInlineInitiativeName, setNewInlineInitiativeName] = useState("");
  const [newInlineActivityName, setNewInlineActivityName] = useState("");
  const [newInlineActivityTarget, setNewInlineActivityTarget] = useState("");
  
  // إضافة هدف استراتيجي جديد مباشرة
  const [isAddingNewStrategicGoal, setIsAddingNewStrategicGoal] = useState(false);
  const [newInlineGoalName, setNewInlineGoalName] = useState("");
  const [newInlineGoalInitiative, setNewInlineGoalInitiative] = useState("");
  const [newInlineGoalActivity, setNewInlineGoalActivity] = useState("");
  const [newInlineGoalTarget, setNewInlineGoalTarget] = useState("");
  
  // Form state
  const [strategicGoal, setStrategicGoal] = useState("");
  const [initiative, setInitiative] = useState("");
  const [activityName, setActivityName] = useState("");
  const [annualTarget, setAnnualTarget] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyTargets, setMonthlyTargets] = useState<number[]>(Array(12).fill(0));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // الأهداف الاستراتيجية والمبادرات
  const [strategicGoals, setStrategicGoals] = useState<StrategicGoal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string>("");
  const [isAddingNewGoal, setIsAddingNewGoal] = useState(false);
  const [isAddingNewInitiative, setIsAddingNewInitiative] = useState(false);
  const [newGoalName, setNewGoalName] = useState("");
  const [newInitiativeName, setNewInitiativeName] = useState("");

  // إذا كان في وضع المعاينة، يظهر كموظف
  const isAdmin = !user.isEmployee && !previewAsEmployee;

  // المبادرات المفلترة حسب الهدف المختار
  const filteredInitiatives = initiatives.filter(
    (init) => init.strategic_goal_id === selectedGoalId
  );

  useEffect(() => {
    fetchPlans();
    fetchStrategicGoals();
    fetchInitiatives();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [authUser, isAdmin]);

  const fetchStrategicGoals = async () => {
    try {
      const { data, error } = await supabase
        .from("strategic_goals")
        .select("*")
        .eq("year", year)
        .order("name");

      if (error) throw error;
      setStrategicGoals(data || []);
    } catch (error) {
      console.error("Error fetching strategic goals:", error);
    }
  };

  const fetchInitiatives = async () => {
    try {
      const { data, error } = await supabase
        .from("initiatives")
        .select("*")
        .order("name");

      if (error) throw error;
      setInitiatives(data || []);
    } catch (error) {
      console.error("Error fetching initiatives:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name")
        .eq("status", "active")
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchPlans = async () => {
    if (!authUser) return;
    
    setLoading(true);
    try {
      const { data: plansData, error } = await supabase
        .from("operational_plans")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch months for each plan
      const plansWithMonths = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { data: monthsData } = await supabase
            .from("operational_plan_months")
            .select("*")
            .eq("operational_plan_id", plan.id)
            .order("month", { ascending: true });

          // Get employee name if admin
          let employee_name = "";
          if (isAdmin && plan.user_id !== authUser.id) {
            const { data: empData } = await supabase
              .from("employees")
              .select("full_name")
              .eq("user_id", plan.user_id)
              .single();
            employee_name = empData?.full_name || "";
          }

          return {
            ...plan,
            months: monthsData || [],
            employee_name
          };
        })
      );

      setPlans(plansWithMonths);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الخطط التشغيلية",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnnualTargetChange = (value: string) => {
    setAnnualTarget(value);
    const target = parseInt(value) || 0;
    // توزيع تلقائي بالتساوي
    const perMonth = Math.floor(target / 12);
    const remainder = target % 12;
    const newTargets = Array(12).fill(perMonth);
    // إضافة الباقي للأشهر الأخيرة
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

  const handleDialogSubmit = async (data: {
    selectedEmployeeId: string;
    goals: LocalGoal[];
    year: number;
  }) => {
    try {
      const targetUserId = isAdmin ? data.selectedEmployeeId : authUser!.id;

      for (const goal of data.goals) {
        if (!goal.name.trim()) continue;

        // إنشاء أو استخدام الهدف الاستراتيجي
        let goalId = goal.existingId;
        if (goal.isNew && goal.name.trim()) {
          const { data: newGoal, error: goalError } = await supabase
            .from("strategic_goals")
            .insert({ name: goal.name.trim(), year: data.year })
            .select()
            .single();
          
          if (goalError) throw goalError;
          goalId = newGoal.id;
        }

        for (const initiative of goal.initiatives) {
          if (!initiative.name.trim()) continue;

          // إنشاء أو استخدام المبادرة
          let initId = initiative.existingId;
          if (initiative.isNew && initiative.name.trim() && goalId) {
            const { data: newInit, error: initError } = await supabase
              .from("initiatives")
              .insert({ name: initiative.name.trim(), strategic_goal_id: goalId })
              .select()
              .single();
            
            if (initError) throw initError;
            initId = newInit.id;
          }

          for (const activity of initiative.activities) {
            if (!activity.name.trim() || activity.annualTarget <= 0) continue;

            // إنشاء الخطة التشغيلية
            const { data: planData, error: planError } = await supabase
              .from("operational_plans")
              .insert({
                user_id: targetUserId,
                strategic_goal: goal.name,
                initiative: initiative.name,
                strategic_goal_id: goalId || null,
                initiative_id: initId || null,
                activity_name: activity.name,
                annual_target: activity.annualTarget,
                year: data.year,
              })
              .select()
              .single();

            if (planError) throw planError;

            // توزيع المستهدف بالتساوي على الأشهر
            const perMonth = Math.floor(activity.annualTarget / 12);
            const remainder = activity.annualTarget % 12;
            const monthlyTargets = Array(12).fill(perMonth);
            for (let i = 11; i >= 12 - remainder; i--) {
              monthlyTargets[i]++;
            }

            const monthsToInsert = monthlyTargets.map((target, index) => ({
              operational_plan_id: planData.id,
              month: index + 1,
              monthly_target: target,
            }));

            const { error: monthsError } = await supabase
              .from("operational_plan_months")
              .insert(monthsToInsert);

            if (monthsError) throw monthsError;
          }
        }
      }

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء الخطط التشغيلية",
      });

      setIsAddDialogOpen(false);
      fetchPlans();
      fetchStrategicGoals();
      fetchInitiatives();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الخطط",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!activityName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم النشاط",
        variant: "destructive",
      });
      return;
    }

    // التحقق من اختيار الموظف للمدير
    if (isAdmin && !selectedEmployeeId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار الموظف",
        variant: "destructive",
      });
      return;
    }

    if (!annualTarget || parseInt(annualTarget) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال المستهدف السنوي",
        variant: "destructive",
      });
      return;
    }

    const totalMonthly = getTotalMonthlyTargets();
    const annualNum = parseInt(annualTarget);
    
    if (totalMonthly !== annualNum) {
      toast({
        title: "تحذير",
        description: `مجموع الأشهر (${totalMonthly}) لا يساوي المستهدف السنوي (${annualNum})`,
        variant: "destructive",
      });
      return;
    }

    try {
      // تحديد user_id بناءً على نوع المستخدم
      const targetUserId = isAdmin ? selectedEmployeeId : authUser!.id;

      // إنشاء هدف استراتيجي جديد إذا لزم الأمر
      let goalId = selectedGoalId;
      if (isAddingNewGoal && newGoalName.trim()) {
        const { data: newGoal, error: goalError } = await supabase
          .from("strategic_goals")
          .insert({ name: newGoalName.trim(), year })
          .select()
          .single();
        
        if (goalError) throw goalError;
        goalId = newGoal.id;
      }

      // إنشاء مبادرة جديدة إذا لزم الأمر
      let initId = selectedInitiativeId;
      if (isAddingNewInitiative && newInitiativeName.trim() && goalId) {
        const { data: newInit, error: initError } = await supabase
          .from("initiatives")
          .insert({ name: newInitiativeName.trim(), strategic_goal_id: goalId })
          .select()
          .single();
        
        if (initError) throw initError;
        initId = newInit.id;
      }

      // الحصول على أسماء الهدف والمبادرة
      const goalName = isAddingNewGoal ? newGoalName : strategicGoals.find(g => g.id === goalId)?.name || strategicGoal;
      const initName = isAddingNewInitiative ? newInitiativeName : filteredInitiatives.find(i => i.id === initId)?.name || initiative;

      // إنشاء الخطة التشغيلية
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: targetUserId,
          strategic_goal: goalName || null,
          initiative: initName || null,
          strategic_goal_id: goalId || null,
          initiative_id: initId || null,
          activity_name: activityName,
          annual_target: parseInt(annualTarget),
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      // إنشاء توزيع الأشهر
      const monthsToInsert = monthlyTargets.map((target, index) => ({
        operational_plan_id: planData.id,
        month: index + 1,
        monthly_target: target,
      }));

      const { error: monthsError } = await supabase
        .from("operational_plan_months")
        .insert(monthsToInsert);

      if (monthsError) throw monthsError;

      toast({
        title: "تم بنجاح",
        description: "تم إنشاء الخطة التشغيلية",
      });

      // Reset form
      setStrategicGoal("");
      setInitiative("");
      setActivityName("");
      setAnnualTarget("");
      setYear(new Date().getFullYear());
      setMonthlyTargets(Array(12).fill(0));
      setSelectedEmployeeId("");
      setSelectedGoalId("");
      setSelectedInitiativeId("");
      setIsAddingNewGoal(false);
      setIsAddingNewInitiative(false);
      setNewGoalName("");
      setNewInitiativeName("");
      setIsAddDialogOpen(false);
      fetchPlans();
      fetchStrategicGoals();
      fetchInitiatives();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء الخطة",
        variant: "destructive",
      });
    }
  };

  const handleViewPlan = (plan: OperationalPlan) => {
    setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخطة؟")) return;

    try {
      const { error } = await supabase
        .from("operational_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف الخطة التشغيلية",
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في حذف الخطة",
        variant: "destructive",
      });
    }
  };

  // حفظ تعديلات الخطة
  const handleSaveEdit = async (planId: string) => {
    if (!editFormData) return;
    
    try {
      const { error } = await supabase
        .from("operational_plans")
        .update({
          activity_name: editFormData.activity_name,
          annual_target: editFormData.annual_target,
          strategic_goal: editFormData.strategic_goal || null,
          initiative: editFormData.initiative || null,
        })
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "تم الحفظ",
        description: "تم حفظ التعديلات بنجاح",
      });

      setEditingPlanId(null);
      setEditFormData(null);
      fetchPlans();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ التعديلات",
        variant: "destructive",
      });
    }
  };

  // بدء تعديل الأهداف الشهرية
  const handleStartEditMonths = (plan: OperationalPlan) => {
    const monthlyValues = Array(12).fill(0);
    plan.months?.forEach(m => {
      if (m.month >= 1 && m.month <= 12) {
        monthlyValues[m.month - 1] = m.monthly_target;
      }
    });
    setEditingMonthlyTargets(prev => ({ ...prev, [plan.id]: monthlyValues }));
    setIsEditingMonths(plan.id);
  };

  // حفظ تعديلات الأهداف الشهرية
  const handleSaveMonthlyTargets = async (plan: OperationalPlan) => {
    const monthlyValues = editingMonthlyTargets[plan.id];
    if (!monthlyValues) return;

    try {
      // تحديث أو إنشاء سجلات الأشهر
      for (let i = 0; i < 12; i++) {
        const monthNum = i + 1;
        const existingMonth = plan.months?.find(m => m.month === monthNum);
        
        if (existingMonth) {
          // تحديث السجل الموجود
          const { error } = await supabase
            .from("operational_plan_months")
            .update({ monthly_target: monthlyValues[i] })
            .eq("id", existingMonth.id);
          if (error) throw error;
        } else {
          // إنشاء سجل جديد
          const { error } = await supabase
            .from("operational_plan_months")
            .insert({
              operational_plan_id: plan.id,
              month: monthNum,
              monthly_target: monthlyValues[i]
            });
          if (error) throw error;
        }
      }

      // تحديث المستهدف السنوي
      const newAnnualTarget = monthlyValues.reduce((sum, val) => sum + val, 0);
      await supabase
        .from("operational_plans")
        .update({ annual_target: newAnnualTarget })
        .eq("id", plan.id);

      toast({
        title: "تم الحفظ",
        description: "تم حفظ الأهداف الشهرية بنجاح",
      });

      setIsEditingMonths(null);
      setEditingMonthlyTargets(prev => {
        const updated = { ...prev };
        delete updated[plan.id];
        return updated;
      });
      fetchPlans();
    } catch (error: any) {
      console.error("Error saving monthly targets:", error);
      toast({
        title: "خطأ",
        description: "فشل في حفظ الأهداف الشهرية",
        variant: "destructive",
      });
    }
  };

  // تحديث قيمة شهر معين
  const handleMonthTargetChange = (planId: string, monthIndex: number, value: number) => {
    setEditingMonthlyTargets(prev => {
      const current = prev[planId] || Array(12).fill(0);
      const updated = [...current];
      updated[monthIndex] = value;
      return { ...prev, [planId]: updated };
    });
  };

  // إضافة نشاط جديد مباشرة تحت مبادرة
  const handleAddActivityUnder = async () => {
    if (!addingActivityUnder || !newActivityName.trim()) return;

    try {
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: addingActivityUnder.userId,
          strategic_goal: addingActivityUnder.strategicGoal,
          initiative: addingActivityUnder.initiative,
          activity_name: newActivityName.trim(),
          annual_target: parseInt(newActivityTarget) || 0,
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة النشاط الجديد",
      });

      setAddingActivityUnder(null);
      setNewActivityName("");
      setNewActivityTarget("");
      fetchPlans();
    } catch (error: any) {
      console.error("Error adding activity:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة النشاط",
        variant: "destructive",
      });
    }
  };

  // إضافة مبادرة جديدة مباشرة تحت هدف استراتيجي
  const handleAddInitiativeUnder = async () => {
    if (!addingInitiativeUnder || !newInlineInitiativeName.trim() || !newInlineActivityName.trim()) return;

    try {
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: authUser!.id,
          strategic_goal: addingInitiativeUnder,
          initiative: newInlineInitiativeName.trim(),
          activity_name: newInlineActivityName.trim(),
          annual_target: parseInt(newInlineActivityTarget) || 0,
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة المبادرة والنشاط الجديد",
      });

      setAddingInitiativeUnder(null);
      setNewInlineInitiativeName("");
      setNewInlineActivityName("");
      setNewInlineActivityTarget("");
      fetchPlans();
    } catch (error: any) {
      console.error("Error adding initiative:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة المبادرة",
        variant: "destructive",
      });
    }
  };

  // إضافة هدف استراتيجي جديد مباشرة
  const handleAddNewStrategicGoal = async () => {
    if (!newInlineGoalName.trim() || !newInlineGoalInitiative.trim() || !newInlineGoalActivity.trim()) return;

    try {
      const { data: planData, error: planError } = await supabase
        .from("operational_plans")
        .insert({
          user_id: authUser!.id,
          strategic_goal: newInlineGoalName.trim(),
          initiative: newInlineGoalInitiative.trim(),
          activity_name: newInlineGoalActivity.trim(),
          annual_target: parseInt(newInlineGoalTarget) || 0,
          year: year,
        })
        .select()
        .single();

      if (planError) throw planError;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة الهدف الاستراتيجي الجديد",
      });

      setIsAddingNewStrategicGoal(false);
      setNewInlineGoalName("");
      setNewInlineGoalInitiative("");
      setNewInlineGoalActivity("");
      setNewInlineGoalTarget("");
      fetchPlans();
    } catch (error: any) {
      console.error("Error adding strategic goal:", error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة الهدف الاستراتيجي",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">نشطة</Badge>;
      case "completed":
        return <Badge className="bg-blue-500">مكتملة</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">معلقة</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isAdmin ? "الخطط التشغيلية" : "الخطة التشغيلية"}
            </h1>
            <p className="text-muted-foreground">
              {isAdmin ? "إدارة الخطط التشغيلية للموظفين" : "إدارة خططك التشغيلية"}
            </p>
          </div>
          
          <div className="flex gap-2">
            {/* زر وضع التعديل */}
            <Button 
              variant={isEditMode ? "default" : "outline"}
              className={`gap-2 ${isEditMode ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
              onClick={() => {
                if (isEditMode) {
                  // إغلاق وضع التعديل
                  setIsEditMode(false);
                  setEditingPlanId(null);
                  setEditFormData(null);
                  setIsEditingMonths(null);
                  setEditingMonthlyTargets({});
                  setAddingActivityUnder(null);
                  setNewActivityName("");
                  setNewActivityTarget("");
                } else {
                  setIsEditMode(true);
                }
              }}
            >
              {isEditMode ? (
                <>
                  <Check className="w-4 h-4" />
                  إنهاء التعديل
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" />
                  التعديل على الخطة
                </>
              )}
            </Button>
            
            <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              إضافة خطة
            </Button>
          </div>
          
          <AddOperationalPlanDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            isAdmin={isAdmin}
            employees={employees}
            strategicGoals={strategicGoals}
            initiatives={initiatives}
            onSubmit={handleDialogSubmit}
          />
        </div>
        
        {/* شريط وضع التعديل */}
        {isEditMode && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-orange-800">وضع التعديل مفعّل</p>
                <p className="text-sm text-orange-600">انقر على أي خلية للتعديل، أو استخدم أزرار الإضافة والحذف</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => {
                setIsEditMode(false);
                setEditingPlanId(null);
                setEditFormData(null);
                setIsEditingMonths(null);
                setEditingMonthlyTargets({});
                setAddingActivityUnder(null);
              }}
            >
              <X className="w-4 h-4 ml-1" />
              إلغاء التعديل
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الخطط</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(plans.length)}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الخطط النشطة</p>
                <p className="text-2xl font-bold">{plans.filter(p => p.status === "active").length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">السنة الحالية</p>
                <p className="text-2xl font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>{new Date().getFullYear()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الخطط التشغيلية</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد خطط تشغيلية حتى الآن
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full">
                  {/* رأس الجدول الرسمي */}
                  <thead>
                    <tr className="bg-gradient-to-r from-[#2d7a85] to-[#3d9aa8] text-white">
                      <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                        <span className="text-sm font-semibold">الهدف الاستراتيجي</span>
                      </th>
                      <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                        <span className="text-sm font-semibold">المبادرة</span>
                      </th>
                      <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                        <span className="text-sm font-semibold">النشاط</span>
                      </th>
                      {isAdmin && (
                        <th className="py-3 px-4 border-l-2 border-white/30 text-right">
                          <span className="text-sm font-semibold">الموظف المكلف</span>
                        </th>
                      )}
                      <th className="w-28 py-3 px-2 border-l-2 border-white/30 text-center">
                        <span className="text-sm font-semibold">المستهدف السنوي</span>
                      </th>
                      <th className="w-28 py-3 px-2 border-l-2 border-white/30 text-center">
                        <span className="text-sm font-semibold">المتوسط الشهري</span>
                      </th>
                      <th className="w-24 py-3 px-2 text-center">
                        <span className="text-sm font-semibold">الإجراء</span>
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody>
                  {(() => {
                    // تجميع الخطط حسب الهدف الاستراتيجي ثم المبادرة
                    const groupedPlans: GroupedPlans[] = [];
                    const goalMap = new Map<string, { initiatives: Map<string, OperationalPlan[]> }>();
                    
                    plans.forEach(plan => {
                      const goal = plan.strategic_goal || "بدون هدف";
                      const init = plan.initiative || "بدون مبادرة";
                      
                      if (!goalMap.has(goal)) {
                        goalMap.set(goal, { initiatives: new Map() });
                      }
                      const goalData = goalMap.get(goal)!;
                      
                      if (!goalData.initiatives.has(init)) {
                        goalData.initiatives.set(init, []);
                      }
                      goalData.initiatives.get(init)!.push(plan);
                    });
                    
                    let colorIndex = 0;
                    goalMap.forEach((goalData, goalName) => {
                      const initiatives: { initiative: string; plans: OperationalPlan[] }[] = [];
                      goalData.initiatives.forEach((plans, initName) => {
                        initiatives.push({ initiative: initName, plans });
                      });
                      groupedPlans.push({
                        strategicGoal: goalName,
                        colorIndex: colorIndex % GOAL_COLORS.length,
                        initiatives
                      });
                      colorIndex++;
                    });
                    
                    const rows: JSX.Element[] = [];
                    
                    groupedPlans.forEach((group, groupIndex) => {
                      const color = GOAL_COLORS[group.colorIndex];
                      // حساب إجمالي الصفوف لهذا الهدف (مع احتساب الصفوف الموسعة)
                      const totalRowsInGoal = group.initiatives.reduce((sum, init) => {
                        return sum + init.plans.reduce((planSum, plan) => {
                          return planSum + 1 + (expandedPlanId === plan.id ? 1 : 0);
                        }, 0);
                      }, 0);
                      
                      let goalRowRendered = false;
                      
                      group.initiatives.forEach((initGroup, initIndex) => {
                        // حساب الصفوف للمبادرة (مع احتساب الصفوف الموسعة)
                        const totalRowsInInitiative = initGroup.plans.reduce((sum, plan) => {
                          return sum + 1 + (expandedPlanId === plan.id ? 1 : 0);
                        }, 0);
                        let initRowRendered = false;
                        
                        initGroup.plans.forEach((plan, planIndex) => {
                          const isExpanded = expandedPlanId === plan.id;
                          const isFirstRowOfGoal = !goalRowRendered;
                          const isFirstRowOfInit = !initRowRendered;
                          const isLastInInitiative = planIndex === initGroup.plans.length - 1;
                          const isLastInitiative = initIndex === group.initiatives.length - 1;
                          const isLastGoal = groupIndex === groupedPlans.length - 1;
                          
                          // تحديد نوع الفاصل السفلي
                          let bottomBorder = '';
                          if (isLastInInitiative && isLastInitiative && !isLastGoal) {
                            // فاصل كبير بين الأهداف الاستراتيجية
                            bottomBorder = 'border-b-4 border-b-gray-500';
                          } else if (isLastInInitiative && !isLastInitiative) {
                            // فاصل كبير بين المبادرات
                            bottomBorder = 'border-b-4 border-b-gray-400';
                          } else if (!isLastInInitiative) {
                            // فاصل صغير بين الأنشطة
                            bottomBorder = 'border-b border-b-gray-200';
                          }
                          
                          rows.push(
                            <tr 
                              key={plan.id} 
                              className={`${color.bg} border-r-4 ${color.border} hover:bg-white/50 transition-all duration-200 ${isExpanded ? 'bg-white/70' : ''} ${bottomBorder}`}
                            >
                              {/* الهدف الاستراتيجي - مدمج أو قابل للتعديل */}
                              {editingPlanId === plan.id ? (
                                <td className={`py-2 px-2 border-l-2 border-gray-300 align-middle ${color.bg}`}>
                                  <Input
                                    value={editFormData?.strategic_goal || ''}
                                    onChange={(e) => setEditFormData(prev => prev ? {...prev, strategic_goal: e.target.value} : null)}
                                    className="h-8 text-xs"
                                    placeholder="الهدف الاستراتيجي"
                                  />
                                </td>
                              ) : isFirstRowOfGoal && (
                                <td 
                                  rowSpan={totalRowsInGoal} 
                                  className={`py-4 px-4 border-l-2 border-gray-300 align-middle ${color.bg}`}
                                >
                                  <p className={`font-semibold text-sm ${color.text}`}>{group.strategicGoal}</p>
                                </td>
                              )}
                              
                              {/* المبادرة - مدمج أو قابل للتعديل */}
                              {editingPlanId === plan.id ? (
                                <td className={`py-2 px-2 border-l-2 border-gray-300 align-middle`}>
                                  <Input
                                    value={editFormData?.initiative || ''}
                                    onChange={(e) => setEditFormData(prev => prev ? {...prev, initiative: e.target.value} : null)}
                                    className="h-8 text-xs"
                                    placeholder="المبادرة"
                                  />
                                </td>
                              ) : isFirstRowOfInit && (
                                <td 
                                  rowSpan={totalRowsInInitiative} 
                                  className={`py-4 px-4 border-l-2 border-gray-300 align-middle ${initIndex > 0 ? 'border-t-2 border-t-gray-400' : ''}`}
                                >
                                  <p className="text-gray-700 text-sm font-medium">{initGroup.initiative}</p>
                                </td>
                              )}
                              
                              {/* النشاط مع السهم */}
                              <td className="py-4 px-4 border-l-2 border-gray-300">
                                {editingPlanId === plan.id ? (
                                  <Input
                                    value={editFormData?.activity_name || ''}
                                    onChange={(e) => setEditFormData(prev => prev ? {...prev, activity_name: e.target.value} : null)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 text-sm font-semibold"
                                    autoFocus
                                  />
                                ) : (
                                  <div 
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={() => handleViewPlan(plan)}
                                  >
                                    <ChevronDown 
                                      className={`w-5 h-5 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180 text-[#2d7a85]' : 'text-[#3d9aa8]'}`} 
                                    />
                                    <p className="font-semibold text-gray-800 text-sm">{plan.activity_name}</p>
                                  </div>
                                )}
                              </td>
                              
                              {/* الموظف المكلف - يظهر فقط للمدير */}
                              {isAdmin && (
                                <td className="py-4 px-4 border-l-2 border-gray-300">
                                  <p className="text-gray-700 text-sm">{plan.employee_name || "-"}</p>
                                </td>
                              )}
                              
                              {/* المستهدف السنوي */}
                              <td className="w-28 py-4 px-2 border-l-2 border-gray-300 text-center">
                                {editingPlanId === plan.id ? (
                                  <Input
                                    type="number"
                                    value={editFormData?.annual_target || 0}
                                    onChange={(e) => setEditFormData(prev => prev ? {...prev, annual_target: parseFloat(e.target.value) || 0} : null)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 text-sm text-center w-full"
                                  />
                                ) : (
                                  <p className="text-lg font-bold text-[#3d9aa8]">{plan.annual_target}</p>
                                )}
                              </td>
                              
                              {/* المتوسط الشهري */}
                              <td className="w-28 py-4 px-2 border-l-2 border-gray-300 text-center bg-white/50">
                                <p className="text-lg font-bold text-[#2d7a85]">
                                  {editingPlanId === plan.id 
                                    ? Math.round((editFormData?.annual_target || 0) / 12)
                                    : Math.round(plan.annual_target / 12)
                                  }
                                </p>
                              </td>
                              
                              {/* الإجراء */}
                              <td className="w-24 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isEditMode && (isAdmin || plan.user_id === authUser?.id) && (
                                    <>
                                      {editingPlanId === plan.id ? (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-green-500 hover:text-green-700 hover:bg-green-50 rounded-full h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSaveEdit(plan.id);
                                            }}
                                          >
                                            <Check className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-full h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingPlanId(null);
                                              setEditFormData(null);
                                            }}
                                          >
                                            <X className="w-4 h-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingPlanId(plan.id);
                                              setEditFormData({
                                                activity_name: plan.activity_name,
                                                annual_target: plan.annual_target,
                                                strategic_goal: plan.strategic_goal || '',
                                                initiative: plan.initiative || '',
                                              });
                                            }}
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeletePlan(plan.id);
                                            }}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                          
                          // المحتوى المنسدل
                          if (isExpanded) {
                            const isEditingThisMonth = isEditingMonths === plan.id;
                            const currentMonthlyValues = editingMonthlyTargets[plan.id] || [];
                            
                            rows.push(
                              <tr key={`${plan.id}-expanded`}>
                                <td colSpan={isAdmin ? 7 : 6} className="p-0">
                                  <div className="bg-gradient-to-b from-white to-gray-50 p-6 border-t border-[#3d9aa8]/20 animate-in slide-in-from-top-2 duration-200">
                                    {/* أزرار التحكم - تظهر فقط في وضع التعديل */}
                                    {isEditMode && (
                                      <div className="flex justify-end mb-3 gap-2">
                                        {isEditingThisMonth ? (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-green-600 hover:bg-green-50"
                                              onClick={() => handleSaveMonthlyTargets(plan)}
                                            >
                                              <Check className="w-4 h-4 ml-1" />
                                              حفظ
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-600 hover:bg-red-50"
                                              onClick={() => {
                                                setIsEditingMonths(null);
                                                setEditingMonthlyTargets(prev => {
                                                  const updated = { ...prev };
                                                  delete updated[plan.id];
                                                  return updated;
                                                });
                                              }}
                                            >
                                              <X className="w-4 h-4 ml-1" />
                                              إلغاء
                                            </Button>
                                          </>
                                        ) : (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-[#3d9aa8] border-[#3d9aa8]/30 hover:bg-[#3d9aa8]/10"
                                            onClick={() => handleStartEditMonths(plan)}
                                          >
                                            <Pencil className="w-4 h-4 ml-1" />
                                            تعديل الأهداف الشهرية
                                        </Button>
                                        )}
                                      </div>
                                    )}
                                    
                                    <div className="overflow-x-auto rounded-xl border border-[#3d9aa8]/20 shadow-sm">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-gradient-to-r from-[#3d9aa8] to-[#4A9BA8]">
                                            {MONTHS_AR.map((month, index) => (
                                              <TableHead 
                                                key={index} 
                                                className="text-center font-medium text-white min-w-[70px] border-l border-white/20"
                                              >
                                                {month}
                                              </TableHead>
                                            ))}
                                            <TableHead className="text-center font-bold text-white bg-[#2d7a85] min-w-[80px]">
                                              المجموع
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          <TableRow className="hover:bg-[#3d9aa8]/5">
                                            {MONTHS_AR.map((_, index) => {
                                              const monthData = plan.months?.find(m => m.month === index + 1);
                                              const target = isEditingThisMonth 
                                                ? (currentMonthlyValues[index] || 0)
                                                : (monthData?.monthly_target || 0);
                                              
                                              return (
                                                <TableCell 
                                                  key={index} 
                                                  className="text-center border-l border-[#3d9aa8]/10 p-1"
                                                >
                                                  {isEditingThisMonth ? (
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      value={target}
                                                      onChange={(e) => handleMonthTargetChange(plan.id, index, parseInt(e.target.value) || 0)}
                                                      className="w-16 h-8 text-center text-sm font-bold mx-auto"
                                                    />
                                                  ) : (
                                                    <span className={`text-lg font-bold ${target > 0 ? 'text-[#3d9aa8]' : 'text-muted-foreground'}`}>
                                                      {target}
                                                    </span>
                                                  )}
                                                </TableCell>
                                              );
                                            })}
                                            <TableCell className="text-center bg-[#3d9aa8]/20">
                                              <span className="text-xl font-bold text-[#2d7a85]">
                                                {isEditingThisMonth 
                                                  ? currentMonthlyValues.reduce((sum, val) => sum + (val || 0), 0)
                                                  : plan.annual_target
                                                }
                                              </span>
                                            </TableCell>
                                          </TableRow>
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          
                          goalRowRendered = true;
                          initRowRendered = true;
                        });
                        
                        // صف إضافة نشاط جديد تحت هذه المبادرة (يظهر فقط في وضع التعديل)
                        if (isEditMode) {
                          const isAddingHere = addingActivityUnder?.strategicGoal === group.strategicGoal && 
                                               addingActivityUnder?.initiative === initGroup.initiative;
                          
                          if (isAddingHere) {
                            rows.push(
                              <tr 
                                key={`add-activity-${group.strategicGoal}-${initGroup.initiative}`} 
                                className={`${color.bg} border-r-4 ${color.border} bg-green-50/50`}
                              >
                                <td className="py-2 px-2"></td>
                                <td className="py-2 px-2"></td>
                                <td className="py-2 px-4 border-l-2 border-gray-300">
                                  <Input
                                    value={newActivityName}
                                    onChange={(e) => setNewActivityName(e.target.value)}
                                    className="h-8 text-sm"
                                    placeholder="اسم النشاط الجديد"
                                    autoFocus
                                  />
                                </td>
                                {isAdmin && <td className="py-2 px-2"></td>}
                                <td className="py-2 px-2 border-l-2 border-gray-300">
                                  <Input
                                    type="number"
                                    value={newActivityTarget}
                                    onChange={(e) => setNewActivityTarget(e.target.value)}
                                    className="h-8 text-sm text-center"
                                    placeholder="المستهدف"
                                  />
                                </td>
                                <td className="py-2 px-2"></td>
                                <td className="py-2 px-2 text-center">
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-green-600 hover:bg-green-100 rounded-full h-8 w-8"
                                      onClick={handleAddActivityUnder}
                                      disabled={!newActivityName.trim()}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-600 hover:bg-red-100 rounded-full h-8 w-8"
                                      onClick={() => {
                                        setAddingActivityUnder(null);
                                        setNewActivityName("");
                                        setNewActivityTarget("");
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          } else {
                            // زر إضافة نشاط جديد في نهاية كل مبادرة
                            rows.push(
                              <tr 
                                key={`add-btn-${group.strategicGoal}-${initGroup.initiative}`} 
                                className={`${color.bg} border-r-4 ${color.border} hover:bg-green-50/30 transition-colors`}
                              >
                                <td colSpan={isAdmin ? 7 : 6} className="py-1 px-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-[#3d9aa8] hover:text-[#2d7a85] hover:bg-[#3d9aa8]/10 gap-1"
                                    onClick={() => setAddingActivityUnder({
                                      strategicGoal: group.strategicGoal,
                                      initiative: initGroup.initiative,
                                      userId: initGroup.plans[0]?.user_id || authUser!.id
                                    })}
                                  >
                                    <Plus className="w-4 h-4" />
                                    إضافة نشاط جديد
                                  </Button>
                                </td>
                              </tr>
                            );
                          }
                        }
                      });
                      
                      // صف إضافة مبادرة جديدة تحت هذا الهدف (يظهر فقط في وضع التعديل)
                      if (isEditMode) {
                        const isAddingInitHere = addingInitiativeUnder === group.strategicGoal;
                        
                        if (isAddingInitHere) {
                          rows.push(
                            <tr 
                              key={`add-initiative-${group.strategicGoal}`} 
                              className={`${color.bg} border-r-4 ${color.border} bg-blue-50/50`}
                            >
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-4 border-l-2 border-gray-300">
                                <Input
                                  value={newInlineInitiativeName}
                                  onChange={(e) => setNewInlineInitiativeName(e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="اسم المبادرة الجديدة"
                                  autoFocus
                                />
                              </td>
                              <td className="py-2 px-4 border-l-2 border-gray-300">
                                <Input
                                  value={newInlineActivityName}
                                  onChange={(e) => setNewInlineActivityName(e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="اسم النشاط"
                                />
                              </td>
                              {isAdmin && <td className="py-2 px-2"></td>}
                              <td className="py-2 px-2 border-l-2 border-gray-300">
                                <Input
                                  type="number"
                                  value={newInlineActivityTarget}
                                  onChange={(e) => setNewInlineActivityTarget(e.target.value)}
                                  className="h-8 text-sm text-center"
                                  placeholder="المستهدف"
                                />
                              </td>
                              <td className="py-2 px-2"></td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-green-600 hover:bg-green-100 rounded-full h-8 w-8"
                                    onClick={handleAddInitiativeUnder}
                                    disabled={!newInlineInitiativeName.trim() || !newInlineActivityName.trim()}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600 hover:bg-red-100 rounded-full h-8 w-8"
                                    onClick={() => {
                                      setAddingInitiativeUnder(null);
                                      setNewInlineInitiativeName("");
                                      setNewInlineActivityName("");
                                      setNewInlineActivityTarget("");
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          rows.push(
                            <tr 
                              key={`add-init-btn-${group.strategicGoal}`} 
                              className={`${color.bg} border-r-4 ${color.border} hover:bg-blue-50/30 transition-colors border-b-4 border-b-gray-400`}
                            >
                              <td colSpan={isAdmin ? 7 : 6} className="py-1 px-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-blue-600 hover:text-blue-800 hover:bg-blue-100 gap-1"
                                  onClick={() => setAddingInitiativeUnder(group.strategicGoal)}
                                >
                                  <Plus className="w-4 h-4" />
                                  إضافة مبادرة جديدة
                                </Button>
                              </td>
                            </tr>
                          );
                        }
                      }
                    });
                    
                    // صف إضافة هدف استراتيجي جديد
                    if (isEditMode) {
                      if (isAddingNewStrategicGoal) {
                        rows.push(
                          <tr 
                            key="add-new-strategic-goal" 
                            className="bg-purple-50/50 border-r-4 border-purple-400"
                          >
                            <td className="py-2 px-4 border-l-2 border-gray-300">
                              <Input
                                value={newInlineGoalName}
                                onChange={(e) => setNewInlineGoalName(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="الهدف الاستراتيجي"
                                autoFocus
                              />
                            </td>
                            <td className="py-2 px-4 border-l-2 border-gray-300">
                              <Input
                                value={newInlineGoalInitiative}
                                onChange={(e) => setNewInlineGoalInitiative(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="المبادرة"
                              />
                            </td>
                            <td className="py-2 px-4 border-l-2 border-gray-300">
                              <Input
                                value={newInlineGoalActivity}
                                onChange={(e) => setNewInlineGoalActivity(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="النشاط"
                              />
                            </td>
                            {isAdmin && <td className="py-2 px-2"></td>}
                            <td className="py-2 px-2 border-l-2 border-gray-300">
                              <Input
                                type="number"
                                value={newInlineGoalTarget}
                                onChange={(e) => setNewInlineGoalTarget(e.target.value)}
                                className="h-8 text-sm text-center"
                                placeholder="المستهدف"
                              />
                            </td>
                            <td className="py-2 px-2"></td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600 hover:bg-green-100 rounded-full h-8 w-8"
                                  onClick={handleAddNewStrategicGoal}
                                  disabled={!newInlineGoalName.trim() || !newInlineGoalInitiative.trim() || !newInlineGoalActivity.trim()}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600 hover:bg-red-100 rounded-full h-8 w-8"
                                  onClick={() => {
                                    setIsAddingNewStrategicGoal(false);
                                    setNewInlineGoalName("");
                                    setNewInlineGoalInitiative("");
                                    setNewInlineGoalActivity("");
                                    setNewInlineGoalTarget("");
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      } else {
                        rows.push(
                          <tr 
                            key="add-goal-btn" 
                            className="bg-purple-50/30 hover:bg-purple-100/50 transition-colors"
                          >
                            <td colSpan={isAdmin ? 7 : 6} className="py-2 px-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-purple-600 hover:text-purple-800 hover:bg-purple-100 gap-1"
                                onClick={() => setIsAddingNewStrategicGoal(true)}
                              >
                                <Plus className="w-4 h-4" />
                                إضافة هدف استراتيجي جديد
                              </Button>
                            </td>
                          </tr>
                        );
                      }
                    }
                    
                    return rows;
                  })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
