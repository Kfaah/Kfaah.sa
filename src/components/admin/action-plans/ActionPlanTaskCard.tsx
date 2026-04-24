import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, ChevronDown, Clock, Download, FileText, Package, Paperclip, Sparkles, Star, Upload, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

const GOAL_HEADER_SURFACE =
  "bg-accent/15 text-accent-foreground border border-accent-foreground/20";

const IMPACT_THEME: Record<string, { badge: string; number: string }> = {
  high:   { badge: GOAL_HEADER_SURFACE, number: GOAL_HEADER_SURFACE },
  medium: { badge: GOAL_HEADER_SURFACE, number: GOAL_HEADER_SURFACE },
  low:    { badge: GOAL_HEADER_SURFACE, number: GOAL_HEADER_SURFACE },
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

  // Auto-assign any unassigned subtask using round-robin over employees (one-time, idempotent)
  useEffect(() => {
    if (!employees.length || !subtasks.length) return;
    const needsAssign = subtasks.some((s) => !s.assigned_employee_id);
    if (!needsAssign) return;
    const next = subtasks.map((s, i) =>
      s.assigned_employee_id ? s : { ...s, assigned_employee_id: employees[(index + i) % employees.length].id },
    );
    onUpdateTask(task.id, { subtasks: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, employees.length]);

  const impactTheme = IMPACT_THEME[task.impact] || IMPACT_THEME.medium;

  return (
    <Card className="overflow-hidden border-border bg-card text-foreground shadow-sm" dir="rtl">
      {/* Header: Goal */}
      <div className="border-b border-accent/20 bg-accent px-6 py-6 text-accent-foreground">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold shadow-md", impactTheme.number)}>
              {index + 1}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="text-2xl font-bold text-accent-foreground leading-tight">{task.title}</h3>
              {task.description && <p className="text-base text-accent-foreground/85 leading-7">{task.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn(
              "px-3 py-1.5 text-sm font-bold shadow-sm",
              impactTheme.badge,
            )}>
              تأثير {IMPACT_LABEL[task.impact] || task.impact}
            </Badge>
            <Badge className="px-3 py-1.5 text-sm bg-accent-foreground/10 text-accent-foreground border border-accent-foreground/20">
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
  donor_list: "عرض PowerPoint جاهز لقائمة الاستهداف",
  message_template: "عرض PowerPoint جاهز للرسالة",
  social_post: "عرض PowerPoint جاهز للحملة",
  report_form: "عرض PowerPoint جاهز للتقرير",
  instructions: "عرض PowerPoint جاهز للتنفيذ",
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
          {attachmentUrl ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch(attachmentUrl);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  const baseName = (attachmentName || `${deliverable.title}.pptx`).trim();
                  a.download = baseName.endsWith(".pptx") ? baseName : `${baseName}.pptx`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch {
                  window.open(attachmentUrl, "_blank");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent text-accent-foreground px-3 py-1.5 text-xs font-bold transition hover:bg-accent/90"
            >
              <Download className="h-3.5 w-3.5" /> تحميل عرض PowerPoint
            </button>
          ) : (
            <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              جارٍ تجهيز ملف PowerPoint
            </span>
          )}
        </div>
      </div>
      {attachmentUrl && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background/80 px-3 py-2 text-sm text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{attachmentName || "عرض PowerPoint مرفق وجاهز للتنزيل"}</span>
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

function computeAutoRating(args: {
  report: string;
  hasFile: boolean;
  status: string;
  dueDate: string | null;
}): { stars: number; reason: string } {
  const reportLen = (args.report || "").trim().length;
  if (!reportLen && !args.hasFile) return { stars: 0, reason: "بانتظار تقرير الموظف" };

  let score = 0;
  const reasons: string[] = [];

  // Quality of written report (length-based proxy, 0-2)
  if (reportLen >= 300) { score += 2; reasons.push("تقرير مفصّل"); }
  else if (reportLen >= 80) { score += 1; reasons.push("تقرير موجز"); }

  // Evidence file uploaded (0-2)
  if (args.hasFile) { score += 2; reasons.push("مرفق إثبات"); }

  // Completion + on-time (0-1)
  if (args.status === "completed") {
    if (args.dueDate) {
      const onTime = new Date() <= new Date(args.dueDate + "T23:59:59");
      if (onTime) { score += 1; reasons.push("ضمن الموعد"); }
      else reasons.push("تأخر عن الموعد");
    } else {
      score += 1;
    }
  }

  return { stars: Math.max(1, Math.min(5, score)), reason: reasons.join(" • ") };
}

function ReportAndRating({
  subtask,
  status,
  dueDate,
  onSave,
}: {
  subtask: ActionPlanSubTask;
  status: string;
  dueDate: string | null;
  onSave: (patch: Partial<ActionPlanSubTask>) => Promise<void>;
}) {
  const [localReport, setLocalReport] = useState(subtask.employee_report || "");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const auto = useMemo(
    () => computeAutoRating({
      report: localReport,
      hasFile: !!subtask.report_file_url,
      status,
      dueDate,
    }),
    [localReport, subtask.report_file_url, status, dueDate],
  );

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("حجم الملف يجب أن يكون أقل من 20MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `reports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("action-plan-files")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("action-plan-files").getPublicUrl(path);
      const newAuto = computeAutoRating({ report: localReport, hasFile: true, status, dueDate });
      await onSave({
        report_file_url: pub.publicUrl,
        report_file_name: file.name,
        rating: newAuto.stars || null,
        rating_notes: newAuto.reason,
      });
      toast.success("تم رفع الملف");
    } catch (e: any) {
      toast.error(e.message || "تعذّر رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const handleReportBlur = async () => {
    if (localReport === (subtask.employee_report || "")) return;
    const newAuto = computeAutoRating({
      report: localReport,
      hasFile: !!subtask.report_file_url,
      status,
      dueDate,
    });
    await onSave({
      employee_report: localReport,
      rating: newAuto.stars || null,
      rating_notes: newAuto.reason,
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Employee report (text + file) */}
      <div className="rounded-md border border-border bg-background/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <FileText className="h-4 w-4" /> تقرير الموظف
        </div>
        <Textarea
          value={localReport}
          onChange={(e) => setLocalReport(e.target.value)}
          onBlur={handleReportBlur}
          placeholder="اكتب تقرير التنفيذ (الأرقام، النتائج، الملاحظات)..."
          rows={4}
          className="text-base leading-7"
        />
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "جاري الرفع..." : subtask.report_file_url ? "استبدال الملف" : "إرفاق ملف الإثبات"}
          </button>
          {subtask.report_file_url && (
            <a
              href={subtask.report_file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {subtask.report_file_name || "الملف المرفق"}
            </a>
          )}
        </div>
      </div>

      {/* Automatic rating */}
      <div className="rounded-md border border-border bg-background/60 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent" /> تقييم تلقائي
        </div>
        <div className="mb-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={cn(
                "h-7 w-7",
                auto.stars > 0 && n <= auto.stars
                  ? "fill-accent text-accent"
                  : "text-muted-foreground/40",
              )}
            />
          ))}
          <span className="ms-2 text-sm font-bold text-foreground">
            {auto.stars > 0 ? `${auto.stars}/5` : "—"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-6">
          {auto.reason || "يحسب تلقائيًا من جودة التقرير، إرفاق الإثبات، والالتزام بالموعد."}
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li>• تقرير ≥ 300 حرف: <span className="text-foreground">+2</span></li>
          <li>• إرفاق ملف الإثبات: <span className="text-foreground">+2</span></li>
          <li>• إنجاز ضمن الموعد: <span className="text-foreground">+1</span></li>
        </ul>
      </div>
    </div>
  );
}