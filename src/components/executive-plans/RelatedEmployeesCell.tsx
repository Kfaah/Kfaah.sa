import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  full_name: string;
  job_title?: string | null;
  department_name?: string | null;
}

interface RelatedRow {
  id: string;
  employee_id: string;
  role_in_activity: string | null;
  source: "manual" | "ai";
}

interface Props {
  executivePlanId: string;
  responsibleEmployeeId: string | null;
  organizationId: string | null;
  activityName: string;
  activityDay: number;
  activityMonth: number;
  activityYear: number;
  allEmployees: Employee[];
}

export function RelatedEmployeesCell({
  executivePlanId,
  responsibleEmployeeId,
  organizationId,
  activityName,
  activityDay,
  activityMonth,
  activityYear,
  allEmployees,
}: Props) {
  const [rows, setRows] = useState<RelatedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");
  const [addRole, setAddRole] = useState("");
  const generatedRef = useRef(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executivePlanId]);

  async function initialize() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_related_employees")
        .select("id, employee_id, role_in_activity, source")
        .eq("executive_plan_id", executivePlanId);
      if (error) throw error;
      const rowsData = (data ?? []) as RelatedRow[];
      setRows(rowsData);
      // Auto-generate AI suggestions on first encounter (no related employees yet + responsible exists)
      if (rowsData.length === 0 && responsibleEmployeeId && !generatedRef.current) {
        generatedRef.current = true;
        setAutoGenerating(true);
        try {
          await supabase.functions.invoke("generate-related-tasks", {
            body: { executive_plan_id: executivePlanId },
          });
          await load();
        } catch (e) {
          console.error("auto-gen related employees", e);
        } finally {
          setAutoGenerating(false);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_related_employees")
        .select("id, employee_id, role_in_activity, source")
        .eq("executive_plan_id", executivePlanId);
      if (error) throw error;
      setRows((data ?? []) as RelatedRow[]);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function dispatchTasksForEmp(empId: string) {
    // Trigger AI generation (covers all related employees) then dispatch any pending
    try {
      const { data: existing } = await supabase
        .from("activity_related_tasks")
        .select("id")
        .eq("executive_plan_id", executivePlanId)
        .eq("employee_id", empId)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.functions.invoke("generate-related-tasks", {
          body: { executive_plan_id: executivePlanId },
        });
      }
      // Dispatch pending tasks for this employee
      const { data: pending } = await supabase
        .from("activity_related_tasks")
        .select("*")
        .eq("executive_plan_id", executivePlanId)
        .eq("employee_id", empId)
        .eq("is_dispatched", false);

      const { data: emp } = await supabase
        .from("employees")
        .select("user_id")
        .eq("id", empId)
        .maybeSingle();
      if (!emp?.user_id || !pending) return;

      const baseDate = new Date(activityYear, activityMonth - 1, activityDay);
      const PHASE_LBL: any = { before: "قبل", during: "أثناء", after: "بعد" };
      for (const t of pending as any[]) {
        const due = new Date(baseDate);
        due.setDate(due.getDate() + (t.day_offset ?? 0));
        const { data: ins } = await supabase
          .from("tasks")
          .insert({
            title: `[${PHASE_LBL[t.phase]}] ${t.title}`,
            description: t.description,
            user_id: emp.user_id,
            executive_plan_id: executivePlanId,
            source_activity_id: executivePlanId,
            phase: t.phase,
            priority: t.priority,
            estimated_time_minutes: t.estimated_minutes,
            due_date: due.toISOString().slice(0, 10),
            ai_generated: t.source === "ai",
            organization_id: organizationId,
          } as any)
          .select("id")
          .maybeSingle();
        await supabase
          .from("activity_related_tasks")
          .update({ is_dispatched: true, dispatched_task_id: ins?.id ?? null })
          .eq("id", t.id);
      }
    } catch (e) {
      console.error("dispatchTasksForEmp", e);
    }
  }

  async function handleAdd() {
    if (!addEmpId) return;
    try {
      const { error } = await supabase
        .from("activity_related_employees")
        .insert({
          executive_plan_id: executivePlanId,
          employee_id: addEmpId,
          role_in_activity: addRole.trim() || null,
          source: "manual",
          organization_id: organizationId,
        } as any);
      if (error) throw error;
      const newEmpId = addEmpId;
      setAddEmpId("");
      setAddRole("");
      setAddOpen(false);
      await load();
      toast({ title: "تمت الإضافة، جاري ترحيل المهام للموظف..." });
      void dispatchTasksForEmp(newEmpId);
    } catch (e: any) {
      toast({ title: "تعذّر الإضافة", description: e.message, variant: "destructive" });
    }
  }

  async function handleRemove(rowId: string, empId: string) {
    if (!confirm("إزالة هذا الموظف من النشاط؟")) return;
    try {
      // Remove undispatched tasks
      await supabase
        .from("activity_related_tasks")
        .delete()
        .eq("executive_plan_id", executivePlanId)
        .eq("employee_id", empId)
        .eq("is_dispatched", false);
      await supabase.from("activity_related_employees").delete().eq("id", rowId);
      await load();
    } catch (e: any) {
      toast({ title: "تعذّر الحذف", description: e.message, variant: "destructive" });
    }
  }

  const empById = new Map(allEmployees.map((e) => [e.id, e]));
  const availableToAdd = allEmployees.filter(
    (e) => e.id !== responsibleEmployeeId && !rows.find((r) => r.employee_id === e.id)
  );

  function initials(name: string) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(loading || autoGenerating) && (
        <span className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] px-1.5 py-0.5 rounded-full">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          {autoGenerating ? "تحليل ذكي..." : "تحميل..."}
        </span>
      )}
      {!loading && !autoGenerating && rows.length === 0 && (
        <span className="text-[10px] text-slate-400 italic">لا موظفين</span>
      )}
      {rows.map((r) => {
        const e = empById.get(r.employee_id);
        const name = e?.full_name ?? "موظف";
        return (
          <div
            key={r.id}
            className={cn(
              "group inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border text-[10px] shadow-sm hover:shadow transition-all",
              r.source === "ai"
                ? "bg-gradient-to-l from-[hsl(var(--primary)/0.08)] to-[hsl(var(--accent)/0.05)] border-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))]"
                : "bg-slate-50 border-slate-200 text-slate-700"
            )}
            title={r.role_in_activity ?? name}
          >
            <div className={cn(
              "w-5 h-5 rounded-full text-white flex items-center justify-center text-[9px] font-bold shrink-0",
              r.source === "ai" ? "bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))]" : "bg-slate-500"
            )}>
              {initials(name)}
            </div>
            <span className="font-semibold max-w-[100px] truncate leading-tight">{name}</span>
            {r.source === "ai" && <Sparkles className="w-2.5 h-2.5 opacity-70 shrink-0" />}
            <button
              onClick={() => handleRemove(r.id, r.employee_id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded-full"
              title="إزالة"
            >
              <X className="w-2.5 h-2.5 text-red-500" />
            </button>
          </div>
        );
      })}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full border border-dashed border-slate-300 hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)]"
            title="إضافة موظف ذي علاقة"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-3 h-3 text-slate-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-[280px] p-2 bg-popover"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <Users className="w-3 h-3" />
              إضافة موظف ذي علاقة
            </div>
            <Select value={addEmpId} onValueChange={setAddEmpId}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="اختر موظفاً..." />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-popover">
                {availableToAdd.length === 0 && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">لا يوجد متاح</div>
                )}
                {availableToAdd.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-[11px]">
                    {e.full_name}
                    {e.department_name ? ` — ${e.department_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              placeholder="دوره في النشاط (اختياري)"
              className="h-7 text-[11px]"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!addEmpId}
              className="w-full h-7 text-[11px]"
            >
              إضافة وترحيل المهام
            </Button>
            <div className="text-[9px] text-slate-400 text-center">
              ستُولَّد مهامه تلقائياً وتُرحَّل لجدوله
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}