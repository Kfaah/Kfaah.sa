import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, ChevronDown, Clock, Copy, Download, FileText, Package, Paperclip, Sparkles, Star, Upload, User } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  attachment_url?: string | null;
  attachment_name?: string | null;
  employee_report?: string | null;
  report_file_url?: string | null;
  report_file_name?: string | null;
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
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
                aria-label="تفاصيل"
              >
                <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
              </button>
          </TableCell>
        </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell></TableCell>
          <TableCell colSpan={5} className="py-5 space-y-4">
            {subtask.details && (
              <div className="rounded-md border border-border bg-background/60 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  تفاصيل التنفيذ
                </div>
                <p className="text-base leading-8 text-foreground whitespace-pre-line">{subtask.details}</p>
              </div>
            )}

            {subtask.deliverable && (
              <DeliverableBlock
                deliverable={subtask.deliverable}
                attachmentUrl={subtask.attachment_url || null}
                attachmentName={subtask.attachment_name || null}
              />
            )}

            <ReportAndRating
              subtask={subtask}
              dueDate={subtask.due_date || null}
              status={status}
              onSave={(patch) => onUpdate(patch)}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

const DELIVERABLE_LABEL: Record<string, string> = {
  donor_list: "قائمة مانحين جاهزة",
  message_template: "قالب رسالة جاهز",
  social_post: "منشور سوشيال ميديا جاهز",
  report_form: "نموذج تقرير قابل للتعبئة",
  instructions: "تعليمات تنفيذية",
};

function DeliverableBlock({
  deliverable,
  attachmentUrl,
  attachmentName,
}: {
  deliverable: NonNullable<ActionPlanSubTask["deliverable"]>;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deliverable.content);
      toast.success("تم النسخ");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  return (
    <div className="rounded-md border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-accent" />
          <span className="text-xs font-bold uppercase tracking-wide text-accent">
            {DELIVERABLE_LABEL[deliverable.type] || "مخرج جاهز"}
          </span>
          <span className="text-base font-semibold text-foreground">— {deliverable.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {attachmentUrl && (
            <a
              href={attachmentUrl}
              download={attachmentName || undefined}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent text-accent-foreground px-3 py-1.5 text-xs font-bold transition hover:bg-accent/90"
            >
              <Download className="h-3.5 w-3.5" /> تحميل الملف الجاهز
            </a>
          )}
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
          >
            <Copy className="h-3.5 w-3.5" /> نسخ
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-background/80 border border-border p-3 text-base leading-8 text-foreground font-sans">
        {deliverable.content}
      </pre>
      {attachmentUrl && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{attachmentName || "ملف مرفق جاهز للتنزيل"}</span>
        </div>
      )}
      {deliverable.fields && deliverable.fields.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-bold text-muted-foreground mb-2">حقول التقرير المطلوبة:</div>
          <ul className="grid grid-cols-2 gap-2 text-sm text-foreground">
            {deliverable.fields.map((f) => (
              <li key={f.key} className="rounded border border-border bg-background/60 px-2 py-1.5">
                {f.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportAndRating({
  report,
  rating,
  ratingNotes,
  onSave,
}: {
  report: string;
  rating: number | null;
  ratingNotes: string;
  onSave: (patch: Partial<ActionPlanSubTask>) => Promise<void>;
}) {
  const [localReport, setLocalReport] = useState(report);
  const [localRating, setLocalRating] = useState<number | null>(rating);
  const [localNotes, setLocalNotes] = useState(ratingNotes);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Employee report */}
      <div className="rounded-md border border-border bg-background/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <FileText className="h-4 w-4" /> تقرير الموظف
        </div>
        <Textarea
          value={localReport}
          onChange={(e) => setLocalReport(e.target.value)}
          onBlur={() => localReport !== report && onSave({ employee_report: localReport })}
          placeholder="يكتب الموظف هنا تقرير تنفيذه (الأرقام، النتائج، الملاحظات)..."
          rows={4}
          className="text-base leading-7"
        />
      </div>

      {/* Manager rating */}
      <div className="rounded-md border border-border bg-background/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Star className="h-4 w-4" /> تقييم الإدارة
        </div>
        <div className="mb-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => {
                setLocalRating(n);
                onSave({ rating: n });
              }}
              className="transition hover:scale-110"
              aria-label={`تقييم ${n}`}
            >
              <Star
                className={cn(
                  "h-7 w-7",
                  localRating && n <= localRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
          {localRating && (
            <button
              onClick={() => {
                setLocalRating(null);
                onSave({ rating: null });
              }}
              className="ms-2 text-xs text-muted-foreground hover:text-foreground"
            >
              مسح
            </button>
          )}
        </div>
        <Textarea
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={() => localNotes !== ratingNotes && onSave({ rating_notes: localNotes })}
          placeholder="ملاحظة الإدارة على التنفيذ..."
          rows={2}
          className="text-sm leading-7"
        />
      </div>
    </div>
  );
}