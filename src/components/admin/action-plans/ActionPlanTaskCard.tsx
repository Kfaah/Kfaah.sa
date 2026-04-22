import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckCircle2, CheckSquare, Clock, Sparkles, Square, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionPlanSubTask {
  title: string;
  details: string;
  duration_days: number;
  done?: boolean;
}

export interface ActionPlanTask {
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
  subtasks: ActionPlanSubTask[] | null;
}

export interface ActionPlanEmployee {
  id: string;
  full_name: string;
  job_role: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "منجزة",
  blocked: "متعثرة",
};

const IMPACT_LABEL: Record<string, string> = {
  high: "عالٍ",
  medium: "متوسط",
  low: "منخفض",
};

const triggerClassName = "h-12 text-base text-right [&>span]:w-full [&>span]:text-right";

export function ActionPlanTaskCard({
  index,
  task,
  employees,
  saving,
  onUpdateTask,
  onToggleSubtask,
  onCompletionNotesChange,
}: {
  index: number;
  task: ActionPlanTask;
  employees: ActionPlanEmployee[];
  saving: boolean;
  onUpdateTask: (id: string, patch: Partial<ActionPlanTask>) => Promise<void>;
  onToggleSubtask: (task: ActionPlanTask, idx: number) => Promise<void>;
  onCompletionNotesChange: (taskId: string, value: string) => void;
}) {
  const completedSubtasks = task.subtasks?.filter((subtask) => subtask.done).length || 0;

  return (
    <Card className="bg-card border-border p-6 shadow-sm" dir="rtl">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-lg font-bold text-accent">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="text-2xl font-bold text-foreground leading-tight">{task.title}</h3>
            {task.description && <p className="text-lg text-muted-foreground leading-8">{task.description}</p>}
          </div>
        </div>

        <Badge className="border border-border bg-transparent px-3 py-1.5 text-sm text-foreground">
          تأثير {IMPACT_LABEL[task.impact] || task.impact}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-5">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> الحالة
          </label>
          <Select value={task.status} onValueChange={(value) => onUpdateTask(task.id, { status: value })}>
            <SelectTrigger className={cn(
              triggerClassName,
              task.status === "completed" && "border-success/50 text-success",
              task.status === "in_progress" && "border-accent/50 text-accent",
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <User className="h-4 w-4" /> الموظف المكلَّف
          </label>
          <Select
            value={task.assigned_employee_id || "unassigned"}
            onValueChange={(value) => onUpdateTask(task.id, { assigned_employee_id: value === "unassigned" ? null : value })}
          >
            <SelectTrigger className={triggerClassName}>
              <SelectValue placeholder="اختر الموظف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">غير مكلَّف</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.full_name} · {employee.job_role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {task.ai_suggestion_reason && task.assigned_employee_id === task.ai_suggested_employee_id && (
            <p className="flex items-start gap-2 text-sm text-accent leading-6">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{task.ai_suggestion_reason}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Calendar className="h-4 w-4" /> الفترة
          </label>
          <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-base text-foreground">
            {(task.start_date || "—")} ← {(task.due_date || "—")}
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
        <h4 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-accent" />
          المهام التنفيذية الدقيقة ({completedSubtasks}/{task.subtasks?.length || 0})
        </h4>

        {task.subtasks && task.subtasks.length > 0 ? (
          <ul className="space-y-3">
            {task.subtasks.map((subtask, idx) => (
              <li key={idx} className="flex items-start gap-4 rounded-lg border border-border bg-background/50 p-4">
                <button
                  onClick={() => onToggleSubtask(task, idx)}
                  className="mt-1 shrink-0 text-accent transition hover:text-accent/80"
                  aria-label={subtask.done ? "إلغاء الإنجاز" : "وضع علامة منجز"}
                >
                  {subtask.done ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className={cn("text-lg font-semibold text-foreground leading-8", subtask.done && "line-through opacity-60")}>
                    {subtask.title}
                  </div>
                  <p className={cn("mt-1 text-base leading-7 text-muted-foreground", subtask.done && "line-through opacity-60")}>
                    {subtask.details}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {subtask.duration_days} يوم</span>
                    <span>{subtask.done ? "منجزة" : "قيد التنفيذ"}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background/40 px-4 py-5 text-base text-muted-foreground">
            لا توجد مهام تنفيذية مولدة لهذه المهمة بعد.
          </div>
        )}
      </div>

      <Textarea
        placeholder="ملاحظات الإنجاز / التقدّم..."
        value={task.completion_notes || ""}
        onChange={(event) => onCompletionNotesChange(task.id, event.target.value)}
        onBlur={() => onUpdateTask(task.id, { completion_notes: task.completion_notes })}
        className="min-h-[96px] text-base leading-7"
        rows={3}
      />
      {saving && <p className="mt-2 text-xs text-muted-foreground">جاري الحفظ...</p>}
    </Card>
  );
}