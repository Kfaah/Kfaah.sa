import { useEffect, useRef, useState } from "react";
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
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Phase = "before" | "during" | "after";

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

const PHASE_META: Record<Phase, { label: string; color: string; chip: string }> = {
  before: { label: "التحضير", color: "bg-sky-50/70 border-sky-100", chip: "text-sky-700 bg-sky-100" },
  during: { label: "التنفيذ", color: "bg-amber-50/70 border-amber-100", chip: "text-amber-700 bg-amber-100" },
  after: { label: "الختام", color: "bg-emerald-50/70 border-emerald-100", chip: "text-emerald-700 bg-emerald-100" },
};

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
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tasks, setTasks] = useState<RelatedTask[]>([]);
  const [addingPhase, setAddingPhase] = useState<Phase | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newOffset, setNewOffset] = useState<number>(0);
  const autoTriedRef = useRef(false);

  useEffect(() => {
    if (!open || !responsibleEmployeeId) return;
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
        .eq("employee_id", responsibleEmployeeId!)
        .order("phase")
        .order("display_order");
      if (error) throw error;
      const list = (data ?? []) as RelatedTask[];
      setTasks(list);
      // Auto-generate in background if empty and not tried yet
      if (list.length === 0 && !autoTriedRef.current && !isPreparing) {
        autoTriedRef.current = true;
        void autoGenerate();
      }
    } catch (e: any) {
      toast({ title: "تعذّر التحميل", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function autoGenerate() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-related-tasks", {
        body: { executive_plan_id: executivePlanId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      // Auto-dispatch newly generated tasks for the responsible employee
      await dispatchPending();
      await load();
    } catch (e: any) {
      toast({ title: "تعذّر التوليد التلقائي", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function dispatchPending() {
    if (!responsibleEmployeeId) return;
    const { data: pending } = await supabase
      .from("activity_related_tasks")
      .select("*")
      .eq("executive_plan_id", executivePlanId)
      .eq("is_dispatched", false);
    if (!pending || pending.length === 0) return;

    const empIds = Array.from(new Set(pending.map((t: any) => t.employee_id)));
    const { data: emps } = await supabase
      .from("employees")
      .select("id, user_id")
      .in("id", empIds);
    const userByEmp = new Map<string, string | null>(
      (emps ?? []).map((e: any) => [e.id, e.user_id])
    );
    const baseDate = new Date(activityYear, activityMonth - 1, activityDay);

    for (const t of pending as any[]) {
      const userId = userByEmp.get(t.employee_id);
      if (!userId) continue;
      const due = new Date(baseDate);
      due.setDate(due.getDate() + (t.day_offset ?? 0));
      const dueStr = due.toISOString().slice(0, 10);
      const phaseLabel = PHASE_META[t.phase as Phase]?.label ?? "";
      const { data: ins, error: insErr } = await supabase
        .from("tasks")
        .insert({
          title: `[${phaseLabel}] ${t.title}`,
          description: t.description,
          user_id: userId,
          executive_plan_id: executivePlanId,
          source_activity_id: executivePlanId,
          phase: t.phase,
          priority: t.priority,
          estimated_time_minutes: t.estimated_minutes,
          due_date: dueStr,
          ai_generated: t.source === "ai",
          organization_id: organizationId,
        } as any)
        .select("id")
        .maybeSingle();
      if (insErr) {
        console.error("dispatch err", insErr);
        continue;
      }
      await supabase
        .from("activity_related_tasks")
        .update({ is_dispatched: true, dispatched_task_id: ins?.id ?? null })
        .eq("id", t.id);
    }
  }

  async function addManual(phase: Phase) {
    if (!newTitle.trim() || !responsibleEmployeeId) return;
    try {
      const { data: ins, error } = await supabase
        .from("activity_related_tasks")
        .insert({
          executive_plan_id: executivePlanId,
          employee_id: responsibleEmployeeId,
          phase,
          title: newTitle.trim(),
          estimated_minutes: 30,
          priority: "medium",
          day_offset: newOffset,
          source: "manual",
          organization_id: organizationId,
        } as any)
        .select("id")
        .maybeSingle();
      if (error) throw error;

      // Immediately dispatch the new manual task to employee's task list
      const { data: emp } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", responsibleEmployeeId)
        .maybeSingle();
      if (emp?.user_id && ins?.id) {
        const baseDate = new Date(activityYear, activityMonth - 1, activityDay);
        const due = new Date(baseDate);
        due.setDate(due.getDate() + newOffset);
        const { data: tIns } = await supabase
          .from("tasks")
          .insert({
            title: `[${PHASE_META[phase].label}] ${newTitle.trim()}`,
            user_id: emp.user_id,
            executive_plan_id: executivePlanId,
            source_activity_id: executivePlanId,
            phase,
            priority: "medium",
            estimated_time_minutes: 30,
            due_date: due.toISOString().slice(0, 10),
            ai_generated: false,
            organization_id: organizationId,
          } as any)
          .select("id")
          .maybeSingle();
        await supabase
          .from("activity_related_tasks")
          .update({ is_dispatched: true, dispatched_task_id: tIns?.id ?? null })
          .eq("id", ins.id);
      }

      setNewTitle("");
      setNewOffset(0);
      setAddingPhase(null);
      await load();
      toast({ title: "تمت إضافة المهمة وترحيلها للموظف" });
    } catch (e: any) {
      toast({ title: "تعذّرت الإضافة", description: e.message, variant: "destructive" });
    }
  }

  async function deleteTask(id: string, isDispatched: boolean, dispatchedId?: string) {
    if (!confirm("حذف هذه المهمة؟")) return;
    try {
      await supabase.from("activity_related_tasks").delete().eq("id", id);
      // Note: we keep the dispatched task in tasks table to avoid breaking history
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
          title="مهام (قبل/أثناء/بعد) للموظف الأساسي"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-bold text-[hsl(var(--primary))]">مراحل</span>
          {isPreparing && totalCount === 0 && (
            <Loader2 className="w-3 h-3 text-[hsl(var(--primary))] animate-spin" />
          )}
          <ChevronDown
            className={cn(
              "w-3 h-3 text-[hsl(var(--primary))] transition-transform",
              open && "rotate-180"
            )}
          />
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
        className="w-[560px] p-0 bg-popover shadow-2xl border-2 border-[hsl(var(--primary)/0.2)] overflow-hidden"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Elegant gradient header */}
        <div className="bg-gradient-to-l from-[hsl(var(--primary))] to-[hsl(var(--accent))] p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{responsibleEmployeeName}</div>
                <div className="text-xs text-white/85 truncate leading-tight mt-0.5">{activityName}</div>
              </div>
            </div>
            {generating || isPreparing ? (
              <Badge className="bg-white/25 text-white border-0 text-[11px] gap-1 backdrop-blur shrink-0 px-2 py-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                تجهيز...
              </Badge>
            ) : totalCount > 0 ? (
              <Badge className="bg-white/25 text-white border-0 text-[11px] gap-1 backdrop-blur shrink-0 px-2 py-1">
                <Zap className="w-3 h-3" />
                {totalCount} مهمة
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
              <span className="text-xs text-slate-500">تحميل المهام...</span>
            </div>
          )}

          {!loading && !responsibleEmployeeId && (
            <div className="text-sm text-slate-500 text-center py-6 italic">
              لم يُحدَّد موظف رئيسي لهذا النشاط
            </div>
          )}

          {!loading && responsibleEmployeeId && (
            <div className="space-y-3">
            {(["before", "during", "after"] as Phase[]).map((phase) => {
              const meta = PHASE_META[phase];
              const list = byPhase[phase];
              const isAdding = addingPhase === phase;
              return (
                <div key={phase} className={cn("rounded-xl border p-3 transition-all", meta.color)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", meta.chip)}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        {list.length} {list.length === 1 ? "مهمة" : "مهام"}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:bg-white/80 rounded-full"
                      onClick={() => {
                        setAddingPhase(isAdding ? null : phase);
                        setNewTitle("");
                        setNewOffset(phase === "before" ? -1 : phase === "after" ? 1 : 0);
                      }}
                      title="إضافة مهمة يدوية"
                    >
                      <Plus className="w-4 h-4 text-slate-700" />
                    </Button>
                  </div>

                  {list.length === 0 && !isAdding && (
                    <div className="text-xs text-slate-400 italic py-2 text-center">
                      {generating ? "يتم التوليد..." : "لا مهام بعد"}
                    </div>
                  )}

                  <ul className="space-y-2">
                    {list.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start gap-2 bg-white/95 backdrop-blur rounded-lg px-3 py-2 border border-white shadow-sm hover:shadow-md group transition-all"
                      >
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 tracking-tight",
                            t.source === "ai" ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {t.source === "ai" ? "AI" : "يدوي"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 leading-relaxed font-medium">{t.title}</div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {t.estimated_minutes} دقيقة
                            </span>
                            {t.day_offset !== 0 && (
                              <span className="font-medium">
                                {t.day_offset > 0 ? `+${t.day_offset}` : t.day_offset} يوم
                              </span>
                            )}
                            {t.is_dispatched && (
                              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                مُرحَّلة
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTask(t.id, t.is_dispatched)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </li>
                    ))}
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
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600">إزاحة الأيام:</label>
                        <Input
                          type="number"
                          value={newOffset}
                          onChange={(e) => setNewOffset(parseInt(e.target.value) || 0)}
                          className="h-9 text-sm w-20"
                        />
                        <Button
                          size="sm"
                          onClick={() => void addManual(phase)}
                          className="h-9 text-xs px-3"
                          disabled={!newTitle.trim()}
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
                المهام تُولَّد وتُرحَّل تلقائياً إلى لوحة مهام الموظف
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}