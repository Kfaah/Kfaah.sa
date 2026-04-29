import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  UserCircle2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Phase = "before" | "during" | "after";

// حدود ذكية للمهام: لا تتجاوز الحدود إلا في حالات نادرة (المهام المُولَّدة بالذكاء الاصطناعي)
const MAX_PER_PHASE_MANUAL = 4;
const MAX_TOTAL_MANUAL = 12;

interface EmployeeOption {
  id: string;
  full_name: string;
  job_title?: string | null;
  department_name?: string | null;
}

interface Props {
  executivePlanId: string;
  responsibleEmployeeId: string | null;
  responsibleEmployeeName: string;
  organizationId: string | null;
  activityName: string;
  activityDay: number;
  activityMonth: number;
  activityYear: number;
  isPreparing?: boolean;
  allEmployees: EmployeeOption[];
}

interface RelatedTask {
  id: string;
  employee_id: string;
  phase: Phase;
  title: string;
  estimated_minutes: number;
  priority: "low" | "medium" | "high";
  day_offset: number;
  source: "manual" | "ai";
  is_dispatched: boolean;
}

const PHASE_META: Record<Phase, { label: string; color: string; chip: string; allowDate: boolean }> = {
  before: { label: "التحضير", color: "bg-sky-50/70 border-sky-100", chip: "text-sky-700 bg-sky-100", allowDate: true },
  during: { label: "التنفيذ", color: "bg-amber-50/70 border-amber-100", chip: "text-amber-700 bg-amber-100", allowDate: false },
  after: { label: "الختام", color: "bg-emerald-50/70 border-emerald-100", chip: "text-emerald-700 bg-emerald-100", allowDate: true },
};

function toDateInputValue(year: number, month: number, day: number, offset: number) {
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function diffDays(year: number, month: number, day: number, isoDate: string) {
  const base = new Date(year, month - 1, day);
  const target = new Date(isoDate);
  return Math.round((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

// عرض التاريخ بتنسيق: اليوم (يمين) / الشهر (وسط) / السنة (يسار)
function formatDatePartsRTL(iso: string) {
  const [y, m, d] = iso.split("-");
  return { day: d, month: m, year: y };
}

export function ActivityPhasesPopover({
  executivePlanId,
  responsibleEmployeeId,
  responsibleEmployeeName,
  organizationId,
  activityName,
  activityDay,
  activityMonth,
  activityYear,
  isPreparing = false,
  allEmployees,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<RelatedTask[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingPhase, setAddingPhase] = useState<Phase | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newOffset, setNewOffset] = useState<number>(0);
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [empPickerOpenFor, setEmpPickerOpenFor] = useState<string | null>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<string, EmployeeOption>();
    for (const e of allEmployees) m.set(e.id, e);
    return m;
  }, [allEmployees]);

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPreparing]);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_related_tasks")
        .select("id, employee_id, phase, title, estimated_minutes, priority, day_offset, source, is_dispatched")
        .eq("executive_plan_id", executivePlanId)
        .order("phase")
        .order("display_order");
      if (error) throw error;
      setTasks((data ?? []) as RelatedTask[]);
    } catch (e: any) {
      toast({ title: "تعذّر التحميل", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // إنشاء/تحديث المهمة المُرحَّلة لموظف معيّن
  async function dispatchTaskFor(taskRow: RelatedTask, overrideEmpId?: string, overrideOffset?: number) {
    const empId = overrideEmpId ?? taskRow.employee_id;
    const offset = overrideOffset ?? taskRow.day_offset;
    const emp = employeeMap.get(empId);
    if (!emp) return;
    const { data: empRow } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", empId)
      .maybeSingle();
    if (!empRow?.user_id) return;

    const dueStr = toDateInputValue(activityYear, activityMonth, activityDay, offset);
    const phaseLabel = PHASE_META[taskRow.phase].label;
    const taskTitle = `[${phaseLabel}] ${taskRow.title}: ${activityName}`;

    // إذا كانت المهمة مُرحَّلة سابقاً، حدّث المهمة الحالية
    if (taskRow.is_dispatched) {
      // ابحث عن المهمة المرتبطة وحدّثها
      const { data: existing } = await supabase
        .from("activity_related_tasks")
        .select("dispatched_task_id")
        .eq("id", taskRow.id)
        .maybeSingle();
      if (existing?.dispatched_task_id) {
        await supabase
          .from("tasks")
          .update({
            title: taskTitle,
            user_id: empRow.user_id,
            due_date: dueStr,
            phase: taskRow.phase,
          } as any)
          .eq("id", existing.dispatched_task_id);
        return;
      }
    }

    const { data: tIns } = await supabase
      .from("tasks")
      .insert({
        title: taskTitle,
        user_id: empRow.user_id,
        executive_plan_id: executivePlanId,
        source_activity_id: executivePlanId,
        phase: taskRow.phase,
        priority: taskRow.priority,
        estimated_time_minutes: taskRow.estimated_minutes,
        due_date: dueStr,
        ai_generated: taskRow.source === "ai",
        organization_id: organizationId,
      } as any)
      .select("id")
      .maybeSingle();
    await supabase
      .from("activity_related_tasks")
      .update({ is_dispatched: true, dispatched_task_id: tIns?.id ?? null })
      .eq("id", taskRow.id);
  }

  async function addManual(phase: Phase) {
    if (!newTitle.trim()) {
      toast({ title: "اكتب عنوان المهمة", variant: "destructive" });
      return;
    }
    const empId = newAssignee ?? responsibleEmployeeId;
    if (!empId) {
      toast({ title: "اختر مسؤولاً عن المهمة", variant: "destructive" });
      return;
    }
    // فرض الحدود الذكية على الإضافة اليدوية فقط
    const phaseCount = tasks.filter((t) => t.phase === phase).length;
    if (phaseCount >= MAX_PER_PHASE_MANUAL) {
      toast({
        title: "بلغت الحد الأقصى لهذه المرحلة",
        description: `لا يُنصح بتجاوز ${MAX_PER_PHASE_MANUAL} مهام في المرحلة الواحدة. احذف مهمة أو ادمجها مع أخرى.`,
        variant: "destructive",
      });
      return;
    }
    if (tasks.length >= MAX_TOTAL_MANUAL) {
      toast({
        title: "بلغت الحد الأقصى الإجمالي",
        description: `الحد الموصى به ${MAX_TOTAL_MANUAL} مهمة لكل نشاط. ركّز على الأهم.`,
        variant: "destructive",
      });
      return;
    }
    try {
      const offset = phase === "during" ? 0 : newOffset;
      const { data: ins, error } = await supabase
        .from("activity_related_tasks")
        .insert({
          executive_plan_id: executivePlanId,
          employee_id: empId,
          phase,
          title: newTitle.trim(),
          estimated_minutes: 30,
          priority: "medium",
          day_offset: offset,
          source: "manual",
          organization_id: organizationId,
        } as any)
        .select("id, employee_id, phase, title, estimated_minutes, priority, day_offset, source, is_dispatched")
        .maybeSingle();
      if (error) throw error;
      if (ins) {
        await dispatchTaskFor(ins as any);
      }
      setNewTitle("");
      setNewOffset(0);
      setNewAssignee(null);
      setAddingPhase(null);
      await load();
      toast({ title: "تمت إضافة المهمة وترحيلها للمسؤول" });
    } catch (e: any) {
      toast({ title: "تعذّرت الإضافة", description: e.message, variant: "destructive" });
    }
  }

  async function changeAssignee(taskRow: RelatedTask, empId: string) {
    setSavingId(taskRow.id);
    try {
      await supabase
        .from("activity_related_tasks")
        .update({ employee_id: empId })
        .eq("id", taskRow.id);
      const updated = { ...taskRow, employee_id: empId };
      await dispatchTaskFor(updated, empId);
      setEmpPickerOpenFor(null);
      await load();
    } catch (e: any) {
      toast({ title: "تعذّر تغيير المسؤول", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function changeDate(taskRow: RelatedTask, isoDate: string) {
    const offset = diffDays(activityYear, activityMonth, activityDay, isoDate);
    setSavingId(taskRow.id);
    try {
      await supabase
        .from("activity_related_tasks")
        .update({ day_offset: offset })
        .eq("id", taskRow.id);
      await dispatchTaskFor(taskRow, undefined, offset);
      await load();
    } catch (e: any) {
      toast({ title: "تعذّر تغيير التاريخ", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTask(id: string) {
    if (!confirm("حذف هذه المهمة؟")) return;
    try {
      // احذف المهمة المرتبطة في tasks أيضاً
      const { data: row } = await supabase
        .from("activity_related_tasks")
        .select("dispatched_task_id")
        .eq("id", id)
        .maybeSingle();
      if (row?.dispatched_task_id) {
        await supabase.from("tasks").delete().eq("id", row.dispatched_task_id);
      }
      await supabase.from("activity_related_tasks").delete().eq("id", id);
      await load();
    } catch (e: any) {
      toast({ title: "تعذّر الحذف", description: e.message, variant: "destructive" });
    }
  }

  const byPhase: Record<Phase, RelatedTask[]> = {
    before: tasks.filter((t) => t.phase === "before"),
    during: tasks.filter((t) => t.phase === "during"),
    after: tasks.filter((t) => t.phase === "after"),
  };

  const totalCount = tasks.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 shrink-0 hover:bg-[hsl(var(--primary)/0.1)] relative gap-1 border border-[hsl(var(--primary)/0.2)] rounded-md"
          title="مهام (تحضير/تنفيذ/ختام)"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-bold text-[hsl(var(--primary))]">
            {isPreparing && totalCount === 0 ? "تجهيز" : "مراحل"}
          </span>
          {isPreparing && totalCount === 0 && (
            <Loader2 className="w-3 h-3 text-[hsl(var(--primary))] animate-spin" />
          )}
          <ChevronDown className={cn("w-3 h-3 text-[hsl(var(--primary))] transition-transform", open && "rotate-180")} />
          {totalCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[hsl(var(--primary))] text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
              {totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[640px] p-0 bg-popover shadow-2xl border-2 border-[hsl(var(--primary)/0.2)] overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--accent))] p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{activityName}</div>
                <div className="text-xs text-white/85 truncate leading-tight mt-0.5">
                  المسؤول الرئيسي: {responsibleEmployeeName}
                </div>
              </div>
            </div>
            {totalCount > 0 && (
              <Badge className="bg-white/25 text-white border-0 text-[11px] gap-1 backdrop-blur shrink-0 px-2 py-1">
                <Zap className="w-3 h-3" />
                {totalCount} مهمة
              </Badge>
            )}
          </div>
        </div>

        <div className="p-4 max-h-[65vh] overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
              <span className="text-xs text-slate-500">تحميل المهام...</span>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {(["before", "during", "after"] as Phase[]).map((phase) => {
                const meta = PHASE_META[phase];
                const list = byPhase[phase];
                const isAdding = addingPhase === phase;
                const phaseFull = list.length >= MAX_PER_PHASE_MANUAL;
                const totalFull = tasks.length >= MAX_TOTAL_MANUAL;
                const cannotAdd = phaseFull || totalFull;
                return (
                  <div key={phase} className={cn("rounded-xl border p-3 transition-all", meta.color)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", meta.chip)}>{meta.label}</span>
                        <span className="text-xs text-slate-600 font-medium">
                          {list.length} / {MAX_PER_PHASE_MANUAL} {list.length === 1 ? "مهمة" : "مهام"}
                        </span>
                        {!meta.allowDate && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            بنفس يوم النشاط
                          </span>
                        )}
                        {cannotAdd && (
                          <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-medium">
                            بلغت الحد الموصى به
                          </span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:bg-white/80 rounded-full disabled:opacity-40"
                        disabled={cannotAdd && !isAdding}
                        title={cannotAdd ? `لا يُنصح بتجاوز ${MAX_PER_PHASE_MANUAL} مهام لكل مرحلة، أو ${MAX_TOTAL_MANUAL} إجمالاً` : "إضافة مهمة"}
                        onClick={() => {
                          setAddingPhase(isAdding ? null : phase);
                          setNewTitle("");
                          setNewAssignee(responsibleEmployeeId ?? null);
                          setNewOffset(phase === "before" ? -1 : phase === "after" ? 1 : 0);
                        }}
                      >
                        <Plus className="w-4 h-4 text-slate-700" />
                      </Button>
                    </div>

                    {list.length === 0 && !isAdding && (
                      <div className="text-xs text-slate-400 italic py-2 text-center">لا مهام بعد</div>
                    )}

                    <ul className="space-y-2">
                      {list.map((t) => {
                        const emp = employeeMap.get(t.employee_id);
                        const isSaving = savingId === t.id;
                        const dueIso = toDateInputValue(activityYear, activityMonth, activityDay, t.day_offset);
                        return (
                          <li
                            key={t.id}
                            className="bg-white/95 backdrop-blur rounded-lg px-3 py-2.5 border border-white shadow-sm hover:shadow-md group transition-all"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-base text-slate-800 leading-relaxed font-semibold mb-2">
                                  {t.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                  {/* المسؤول */}
                                  <Popover
                                    open={empPickerOpenFor === t.id}
                                    onOpenChange={(o) => setEmpPickerOpenFor(o ? t.id : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <button
                                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md font-medium transition-colors text-[13px]"
                                        disabled={isSaving}
                                      >
                                        <UserCircle2 className="w-3.5 h-3.5" />
                                        <span>{emp?.full_name ?? "اختر مسؤولاً"}</span>
                                        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-0" align="start" dir="rtl">
                                      <Command>
                                        <CommandInput placeholder="ابحث عن موظف..." className="h-9" />
                                        <CommandList>
                                          <CommandEmpty>لا يوجد موظف</CommandEmpty>
                                          <CommandGroup>
                                            {allEmployees.map((e) => (
                                              <CommandItem
                                                key={e.id}
                                                value={`${e.full_name} ${e.job_title ?? ""} ${e.department_name ?? ""}`}
                                                onSelect={() => void changeAssignee(t, e.id)}
                                              >
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-medium">{e.full_name}</span>
                                                  {(e.job_title || e.department_name) && (
                                                    <span className="text-[10px] text-slate-500">
                                                      {[e.job_title, e.department_name].filter(Boolean).join(" — ")}
                                                    </span>
                                                  )}
                                                </div>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>

                                  {/* التاريخ */}
                                  {meta.allowDate ? (
                                    <label className="relative inline-flex items-center gap-2 bg-white border-2 border-[hsl(var(--primary)/0.25)] hover:border-[hsl(var(--primary)/0.6)] text-slate-800 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer shadow-sm">
                                      <CalendarIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
                                      {(() => {
                                        const p = formatDatePartsRTL(dueIso);
                                        return (
                                          <span dir="ltr" className="inline-flex items-center gap-1 text-[15px] font-bold tracking-wide tabular-nums">
                                            <span className="text-slate-500">{p.year}</span>
                                            <span className="text-slate-300">/</span>
                                            <span className="text-slate-700">{p.month}</span>
                                            <span className="text-slate-300">/</span>
                                            <span className="text-[hsl(var(--primary))]">{p.day}</span>
                                          </span>
                                        );
                                      })()}
                                      <input
                                        type="date"
                                        value={dueIso}
                                        onChange={(e) => void changeDate(t, e.target.value)}
                                        disabled={isSaving}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                      />
                                    </label>
                                  ) : (
                                    <span className="inline-flex items-center gap-2 bg-amber-50 border-2 border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg font-bold shadow-sm">
                                      <CalendarIcon className="w-4 h-4" />
                                      {(() => {
                                        const p = formatDatePartsRTL(dueIso);
                                        return (
                                          <span dir="ltr" className="inline-flex items-center gap-1 text-[15px] font-bold tracking-wide tabular-nums">
                                            <span className="opacity-70">{p.year}</span>
                                            <span className="opacity-40">/</span>
                                            <span>{p.month}</span>
                                            <span className="opacity-40">/</span>
                                            <span className="text-amber-900">{p.day}</span>
                                          </span>
                                        );
                                      })()}
                                    </span>
                                  )}

                                  {t.is_dispatched && (
                                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                      <CheckCircle2 className="w-3 h-3" />
                                      مُرحَّلة
                                    </span>
                                  )}
                                  {isSaving && <Loader2 className="w-3 h-3 animate-spin text-[hsl(var(--primary))]" />}
                                </div>
                              </div>
                              <button
                                onClick={() => void deleteTask(t.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded shrink-0"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {isAdding && (
                      <div className="mt-2 space-y-2 bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                        <Input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="عنوان المهمة..."
                          className="h-9 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void addManual(phase);
                            if (e.key === "Escape") setAddingPhase(null);
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          {/* اختيار المسؤول */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1.5 rounded-md text-xs font-medium">
                                <UserCircle2 className="w-3.5 h-3.5" />
                                {newAssignee ? employeeMap.get(newAssignee)?.full_name ?? "مسؤول" : "اختر مسؤولاً"}
                                <ChevronDown className="w-3 h-3 opacity-60" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start" dir="rtl">
                              <Command>
                                <CommandInput placeholder="ابحث عن موظف..." className="h-9" />
                                <CommandList>
                                  <CommandEmpty>لا يوجد موظف</CommandEmpty>
                                  <CommandGroup>
                                    {allEmployees.map((e) => (
                                      <CommandItem
                                        key={e.id}
                                        value={`${e.full_name} ${e.job_title ?? ""} ${e.department_name ?? ""}`}
                                        onSelect={() => setNewAssignee(e.id)}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">{e.full_name}</span>
                                          {(e.job_title || e.department_name) && (
                                            <span className="text-[10px] text-slate-500">
                                              {[e.job_title, e.department_name].filter(Boolean).join(" — ")}
                                            </span>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {meta.allowDate && (
                            <label className="relative inline-flex items-center gap-2 bg-white border-2 border-[hsl(var(--primary)/0.25)] hover:border-[hsl(var(--primary)/0.6)] text-slate-800 px-3 py-2 rounded-lg cursor-pointer shadow-sm">
                              <CalendarIcon className="w-4 h-4 text-[hsl(var(--primary))]" />
                              {(() => {
                                const iso = toDateInputValue(activityYear, activityMonth, activityDay, newOffset);
                                const p = formatDatePartsRTL(iso);
                                return (
                                  <span dir="ltr" className="inline-flex items-center gap-1 text-[15px] font-bold tracking-wide tabular-nums">
                                    <span className="text-slate-500">{p.year}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-slate-700">{p.month}</span>
                                    <span className="text-slate-300">/</span>
                                    <span className="text-[hsl(var(--primary))]">{p.day}</span>
                                  </span>
                                );
                              })()}
                              <input
                                type="date"
                                value={toDateInputValue(activityYear, activityMonth, activityDay, newOffset)}
                                onChange={(e) =>
                                  setNewOffset(diffDays(activityYear, activityMonth, activityDay, e.target.value))
                                }
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </label>
                          )}

                          <Button
                            size="sm"
                            onClick={() => void addManual(phase)}
                            className="h-9 text-xs px-3 mr-auto"
                            disabled={!newTitle.trim() || !(newAssignee ?? responsibleEmployeeId)}
                          >
                            إضافة وترحيل
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setAddingPhase(null)}
                            className="h-9 text-xs px-3"
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 pt-1.5 border-t border-slate-100">
                <Zap className="w-2.5 h-2.5" />
                كل بند يُرحَّل تلقائياً للمسؤول • الحد الموصى به {MAX_PER_PHASE_MANUAL} لكل مرحلة و{MAX_TOTAL_MANUAL} إجمالاً
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
