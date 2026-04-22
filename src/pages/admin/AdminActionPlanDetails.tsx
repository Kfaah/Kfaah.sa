import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRightCircle, Calendar, CheckCircle2, Clock, Loader2, Sparkles, User, ListChecks, CheckSquare, Square,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  impact: string;
  status: string;
  priority: number;
  start_date: string | null;
  due_date: string | null;
  assigned_employee_id: string | null;
  ai_suggested_employee_id: string | null;
  ai_suggestion_reason: string | null;
  completion_notes: string | null;
  subtasks: SubTask[] | null;
}
interface SubTask {
  title: string;
  details: string;
  duration_days: number;
  done?: boolean;
}
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

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "منجزة",
  blocked: "متعثرة",
};
const IMPACT_LABEL: Record<string, string> = { high: "عالٍ", medium: "متوسط", low: "منخفض" };

export default function AdminActionPlanDetails() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; job_role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState<string | null>(null);

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
    setTasks((taskData || []) as unknown as Task[]);
    setEmployees((empData || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [planId]);

  const updateTask = async (id: string, patch: Partial<Task>) => {
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

  const toggleSubtask = async (task: Task, idx: number) => {
    const next = (task.subtasks || []).map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: next } : t));
    const { error } = await supabase
      .from("action_plan_tasks")
      .update({ subtasks: next as any })
      .eq("id", task.id);
    if (error) toast.error("تعذّر حفظ المهمة الفرعية");
  };

  return (
    <div className="p-8 space-y-6" dir="rtl">
      <Button variant="ghost" onClick={() => navigate("/admin/action-plans")} className="text-white hover:bg-white/10 gap-2">
        <ArrowRightCircle className="w-4 h-4" />
        رجوع للخطط
      </Button>

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

      <div className="space-y-3">
        {tasks.map((t, i) => (
          <Card key={t.id} className="bg-card border-border p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center font-bold text-base shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-foreground leading-tight">{t.title}</h3>
                  {t.description && <p className="text-base text-muted-foreground mt-2 leading-relaxed">{t.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-transparent text-foreground border border-border text-sm px-3 py-1">
                  تأثير {IMPACT_LABEL[t.impact] || t.impact}
                </Badge>
              </div>
            </div>

            {/* Executive subtasks */}
            {t.subtasks && t.subtasks.length > 0 && (
              <div className="mb-4 bg-muted/30 border border-border rounded-lg p-4">
                <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  المهام التنفيذية الدقيقة ({t.subtasks.filter(s => s.done).length}/{t.subtasks.length})
                </h4>
                <ul className="space-y-2.5">
                  {t.subtasks.map((sub, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <button
                        onClick={() => toggleSubtask(t, idx)}
                        className="mt-0.5 shrink-0 text-accent hover:text-accent/80 transition"
                        aria-label={sub.done ? "إلغاء الإنجاز" : "وضع علامة منجز"}
                      >
                        {sub.done ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-base font-semibold text-foreground leading-snug",
                          sub.done && "line-through opacity-60"
                        )}>
                          {sub.title}
                        </div>
                        <p className={cn(
                          "text-sm text-muted-foreground mt-1 leading-relaxed",
                          sub.done && "line-through opacity-60"
                        )}>
                          {sub.details}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                          <Clock className="w-3 h-3" /> {sub.duration_days} يوم
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <User className="w-3 h-3" /> الموظف المكلَّف
                </label>
                <Select
                  value={t.assigned_employee_id || "unassigned"}
                  onValueChange={(v) => updateTask(t.id, { assigned_employee_id: v === "unassigned" ? null : v })}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="اختر..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">— غير مكلَّف —</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.job_role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {t.ai_suggestion_reason && t.assigned_employee_id === t.ai_suggested_employee_id && (
                  <p className="text-xs text-accent flex items-start gap-1 mt-1">
                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{t.ai_suggestion_reason}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> الفترة
                </label>
                <div className="text-sm text-foreground bg-muted/50 px-3 py-2.5 rounded-md border border-border">
                  {t.start_date} → {t.due_date}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">الحالة</label>
                <Select value={t.status} onValueChange={(v) => updateTask(t.id, { status: v })}>
                  <SelectTrigger className={cn("h-10 text-sm",
                    t.status === "completed" && "border-success/50 text-success",
                    t.status === "in_progress" && "border-accent/50 text-accent",
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Textarea
              placeholder="ملاحظات الإنجاز / التقدّم..."
              value={t.completion_notes || ""}
              onChange={(e) => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, completion_notes: e.target.value } : x))}
              onBlur={() => updateTask(t.id, { completion_notes: t.completion_notes })}
              className="text-sm"
              rows={2}
            />
            {savingTask === t.id && <p className="text-[10px] text-muted-foreground mt-1">جاري الحفظ...</p>}
          </Card>
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