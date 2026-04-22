import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, ChevronDown, Clock, Copy, FileText, Package, Sparkles, Star, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ActionPlanSubTask {
  title: string;
  details: string;
  duration_days: number;
  done?: boolean;
  assigned_employee_id?: string | null;
  status?: string;
  start_date?: string | null;
  due_date?: string | null;
  deliverable?: {
    type: "donor_list" | "message_template" | "social_post" | "report_form" | "instructions";
    title: string;
    content: string;
    fields?: { label: string; key: string }[];
  } | null;
  employee_report?: string | null;
  rating?: number | null;
  rating_notes?: string | null;
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
  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => (s.status ? s.status === "completed" : s.done)).length;

  const updateSubtask = async (idx: number, patch: Partial<ActionPlanSubTask>) => {
    const next = subtasks.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    await onUpdateTask(task.id, { subtasks: next });
  };

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden" dir="rtl">
      {/* Header: Goal */}
      <div className="p-6 border-b border-border bg-gradient-to-l from-accent/5 to-transparent">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-lg font-bold text-accent">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="text-2xl font-bold text-foreground leading-tight">{task.title}</h3>
              {task.description && <p className="text-base text-muted-foreground leading-7">{task.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="border border-border bg-transparent px-3 py-1.5 text-sm text-foreground">
              تأثير {IMPACT_LABEL[task.impact] || task.impact}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1.5 text-sm">
              {completedSubtasks}/{subtasks.length} منجزة
            </Badge>
          </div>
        </div>
      </div>

      {/* Executive Tasks Table */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-accent" />
          الخطة التنفيذية
        </div>

        {subtasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-base text-muted-foreground">
            لا توجد مهام تنفيذية مولدة لهذه المهمة بعد.
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="w-12 text-right text-foreground font-bold">#</TableHead>
                  <TableHead className="text-right text-foreground font-bold">المهمة التنفيذية</TableHead>
                  <TableHead className="w-[200px] text-right text-foreground font-bold">
                    <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4" /> الموظف المكلَّف</span>
                  </TableHead>
                  <TableHead className="w-[120px] text-right text-foreground font-bold">
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> الفترة</span>
                  </TableHead>
                  <TableHead className="w-[170px] text-right text-foreground font-bold">
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> الحالة</span>
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subtasks.map((subtask, idx) => (
                  <SubtaskRow
                    key={idx}
                    idx={idx}
                    subtask={subtask}
                    employees={employees}
                    onUpdate={(patch) => updateSubtask(idx, patch)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="px-4 pb-4">
        <Textarea
          placeholder="ملاحظات الإنجاز / التقدّم على الهدف..."
          value={task.completion_notes || ""}
          onChange={(event) => onCompletionNotesChange(task.id, event.target.value)}
          onBlur={() => onUpdateTask(task.id, { completion_notes: task.completion_notes })}
          className="min-h-[80px] text-base leading-7"
          rows={3}
        />
        {saving && <p className="mt-2 text-xs text-muted-foreground">جاري الحفظ...</p>}
      </div>
    </Card>
  );
}

function SubtaskRow({
  idx,
  subtask,
  employees,
  onUpdate,
}: {
  idx: number;
  subtask: ActionPlanSubTask;
  employees: ActionPlanEmployee[];
  onUpdate: (patch: Partial<ActionPlanSubTask>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const status = subtask.status || (subtask.done ? "completed" : "pending");
  const assignedId = subtask.assigned_employee_id || "unassigned";
  const assignedName = employees.find((e) => e.id === subtask.assigned_employee_id)?.full_name;

  return (
    <>
      <TableRow className={cn("align-top", status === "completed" && "bg-success/5")}>
          <TableCell className="text-right font-bold text-accent text-base pt-4">{idx + 1}</TableCell>
          <TableCell className="text-right">
            <div className={cn("text-base font-semibold text-foreground leading-7", status === "completed" && "line-through opacity-70")}>
              {subtask.title}
            </div>
            {!open && subtask.details && (
              <p className="mt-1 text-sm text-muted-foreground leading-6 line-clamp-1">{subtask.details}</p>
            )}
          </TableCell>
          <TableCell>
            <Select
              value={assignedId}
              onValueChange={(value) => onUpdate({ assigned_employee_id: value === "unassigned" ? null : value })}
              dir="rtl"
            >
              <SelectTrigger className="h-10 text-sm text-right [&>span]:w-full [&>span]:text-right">
                <SelectValue placeholder="اختر الموظف">{assignedName || "غير مكلَّف"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">غير مكلَّف</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.job_role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="text-right text-sm text-foreground pt-4 whitespace-nowrap">
            {subtask.duration_days} يوم
          </TableCell>
          <TableCell>
            <Select
              value={status}
              onValueChange={(value) => onUpdate({ status: value, done: value === "completed" })}
              dir="rtl"
            >
              <SelectTrigger className={cn(
                "h-10 text-sm text-right [&>span]:w-full [&>span]:text-right",
                status === "completed" && "border-success/60 text-success",
                status === "in_progress" && "border-accent/60 text-accent",
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell className="pt-3">
            {subtask.details && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
                aria-label="تفاصيل"
              >
                <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </TableCell>
        </TableRow>
      {open && subtask.details && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell></TableCell>
          <TableCell colSpan={5} className="py-4">
            <div className="rounded-md border border-border bg-background/60 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                تفاصيل التنفيذ
              </div>
              <p className="text-base leading-8 text-foreground whitespace-pre-line">{subtask.details}</p>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}