import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRightCircle, Calendar, CheckCircle2, Clock, Download, Loader2, Sparkles, ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ActionPlanTaskCard, type ActionPlanEmployee, type ActionPlanTask } from "@/components/admin/action-plans/ActionPlanTaskCard";
import { exportActionPlanExcel } from "@/utils/exportActionPlanExcel";

interface Plan {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
  org_name?: string;
}

export default function AdminActionPlanDetails() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<ActionPlanTask[]>([]);
  const [employees, setEmployees] = useState<ActionPlanEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    if (!planId) return;
    setLoading(true);
    const { data: planData } = await supabase
      .from("action_plans")
      .select("*, organizations(name)")
      .eq("id", planId).maybeSingle();
    if (!planData) { toast.error("الخطة غير موجودة"); navigate("/admin/action-plans"); return; }
    setPlan({ ...planData, org_name: (planData as any).organizations?.name });

    const [{ data: taskData }, { data: empData }] = await Promise.all([
      supabase.from("action_plan_tasks").select("*").eq("action_plan_id", planId).order("priority"),
      supabase.from("employees").select("id, full_name, job_role").eq("organization_id", planData.organization_id),
    ]);
    setTasks((taskData || []) as unknown as ActionPlanTask[]);
    setEmployees((empData || []) as ActionPlanEmployee[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [planId]);

  const updateTask = async (id: string, patch: Partial<ActionPlanTask>) => {
    setSavingTask(id);
    const finalPatch: any = { ...patch };
    if (patch.status === "completed") finalPatch.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== "completed") finalPatch.completed_at = null;
    const { error } = await supabase.from("action_plan_tasks").update(finalPatch).eq("id", id);
    setSavingTask(null);
    if (error) { toast.error("تعذّر التحديث"); return; }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    // refresh plan progress
    const total = tasks.length;
    const done = tasks.filter(t => t.id === id ? patch.status === "completed" : t.status === "completed").length;
    const progress = total ? (done / total) * 100 : 0;
    await supabase.from("action_plans").update({ progress }).eq("id", planId!);
  };

  if (loading || !plan) {
    return (
      <div className="p-8 flex items-center justify-center text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const done = tasks.filter(t => t.status === "completed").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const pending = tasks.filter(t => t.status === "pending").length;
  const progress = tasks.length ? (done / tasks.length) * 100 : 0;

  const toggleSubtask = async (task: ActionPlanTask, idx: number) => {
    const next = (task.subtasks || []).map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: next } : t));
    const { error } = await supabase
      .from("action_plan_tasks")
      .update({ subtasks: next as any })
      .eq("id", task.id);
    if (error) toast.error("تعذّر حفظ المهمة الفرعية");
  };

  const handleCompletionNotesChange = (taskId: string, value: string) => {
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, completion_notes: value } : task));
  };

  const handleExportExcel = async () => {
    if (!plan) return;
    try {
      setExporting(true);
      exportActionPlanExcel({ plan, tasks, employees });
      toast.success("تم تصدير الخطة إلى Excel");
    } catch {
      toast.error("تعذّر تصدير ملف Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate("/admin/action-plans")} className="text-white hover:bg-white/10 gap-2">
          <ArrowRightCircle className="w-4 h-4" />
          رجوع للخطط
        </Button>
        <Button onClick={handleExportExcel} disabled={exporting || !plan} className="gap-2">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          تصدير Excel
        </Button>
      </div>

      <Card className="bg-card border-border p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground mb-1">{plan.org_name}</div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ListChecks className="w-7 h-7 text-accent" />
              {plan.title}
            </h1>
            {plan.description && <p className="text-base text-muted-foreground mt-3 max-w-3xl leading-relaxed">{plan.description}</p>}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-3">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {plan.start_date} → {plan.end_date}</span>
              <Badge variant={plan.status === "active" ? "default" : "secondary"} className="text-sm">{plan.status === "active" ? "نشطة" : plan.status}</Badge>
            </div>
          </div>
          <div className="text-center min-w-[200px]">
            <div className="text-5xl font-bold text-accent">{progress.toFixed(0)}%</div>
            <div className="text-sm text-muted-foreground mt-1">{done}/{tasks.length} مكتملة</div>
            <Progress value={progress} className="mt-2" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <StatPill icon={Clock} label="قيد الانتظار" value={pending} color="text-muted-foreground" />
          <StatPill icon={Sparkles} label="قيد التنفيذ" value={inProgress} color="text-accent" />
          <StatPill icon={CheckCircle2} label="منجزة" value={done} color="text-success" />
        </div>
      </Card>

      <div className="space-y-4">
        {tasks.map((task, index) => (
          <ActionPlanTaskCard
            key={task.id}
            index={index}
            task={task}
            employees={employees}
            saving={savingTask === task.id}
            onUpdateTask={updateTask}
            onToggleSubtask={toggleSubtask}
            onCompletionNotesChange={handleCompletionNotesChange}
          />
        ))}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <Icon className={cn("w-5 h-5", color)} />
      <div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}