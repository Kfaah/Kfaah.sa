import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Button } from "@/components/ui/button";
import { Loader2, Users, Plus, X, Sparkles, ArrowLeft } from "lucide-react";
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
  initiativeName?: string | null;
  subInitiativeName?: string | null;
  activityDay: number;
  activityMonth: number;
  activityYear: number;
  allEmployees: Employee[];
  onNavigateToEmployee?: (employeeId: string, executivePlanId?: string) => void;
}

export function RelatedEmployeesIndicator({
  executivePlanId,
  responsibleEmployeeId,
  organizationId,
  activityName,
  initiativeName,
  subInitiativeName,
  activityDay,
  activityMonth,
  activityYear,
  allEmployees,
  onNavigateToEmployee,
}: Props) {
  const [rows, setRows] = useState<RelatedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [addEmpId, setAddEmpId] = useState("");
  const [addRole, setAddRole] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [navigatingEmpId, setNavigatingEmpId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();

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
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function load() {
    try {
      const { data, error } = await supabase
        .from("activity_related_employees")
        .select("id, employee_id, role_in_activity, source")
        .eq("executive_plan_id", executivePlanId);
      if (error) throw error;
      setRows((data ?? []) as RelatedRow[]);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function dispatchTasksForEmp(empId: string) {
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
      setShowAddForm(false);
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

  async function handleGenerateRelations() {
    setAutoGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-related-tasks", {
        body: { executive_plan_id: executivePlanId },
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      toast({ title: "تعذّر توليد العلاقات", description: e.message, variant: "destructive" });
    } finally {
      setAutoGenerating(false);
    }
  }

  function normalizeAnchorValue(value: unknown): string {
    return String(value ?? "")
      .trim()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/ـ/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function isVisibleTarget(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function centerTarget(target: HTMLElement) {
    const scrollParent = target.closest<HTMLElement>("[data-executive-plans-scroll]");
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      scrollParent.scrollTop += targetRect.top - parentRect.top - parentRect.height / 2 + targetRect.height / 2;
      scrollParent.scrollLeft += targetRect.left - parentRect.left - parentRect.width / 2 + targetRect.width / 2;
      return;
    }
    target.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
  }

  function navigateToEmployee(empId: string) {
    void goToDerivedTask(empId);
  }

  /**
   * ينقل المستخدم إلى المهمة المُشتقّة الخاصة بهذا الموظف لهذا النشاط
   * (مثلاً مهمة "توثيق دورات تدريب مهني" الخاصة بالموثق الإعلامي).
   * إذا لم تكن المهمة قد رُحِّلت بعد، نُرحّلها أولاً ثم ننتقل.
   */
  async function goToDerivedTask(empId: string) {
    if (navigatingEmpId) return;
    setNavigatingEmpId(empId);
    try {
      // 1) ابحث عن مهمة مُرحَّلة سابقاً لهذا الموظف ضمن هذا النشاط
      let taskId = await findDispatchedTaskId(empId);

      // 2) إن لم توجد، رحّل المهام لهذا الموظف ثم أعد البحث
      if (!taskId) {
        await dispatchTasksForEmp(empId);
        taskId = await findDispatchedTaskId(empId);
      }

      if (!taskId) {
        toast({
          title: "لا توجد مهمة مرتبطة بعد",
          description: "تعذّر العثور على مهمة مُشتقّة لهذا الموظف ضمن هذا النشاط.",
          variant: "destructive",
        });
        return;
      }

      setOpen(false);
      const path = slug ? `/${slug}/tasks/${taskId}` : `/tasks/${taskId}`;
      navigate(path);
    } catch (e: any) {
      console.error("goToDerivedTask", e);
      toast({ title: "تعذّر الانتقال إلى المهمة", description: e.message, variant: "destructive" });
    } finally {
      setNavigatingEmpId(null);
    }
  }

  async function findDispatchedTaskId(empId: string): Promise<string | null> {
    // اجلب user_id للموظف
    const { data: emp } = await supabase
      .from("employees")
      .select("user_id")
      .eq("id", empId)
      .maybeSingle();
    if (!emp?.user_id) return null;

    // ابحث عن مهمة في tasks تخص هذا الموظف ومرتبطة بهذا النشاط
    const { data: t } = await supabase
      .from("tasks")
      .select("id")
      .eq("executive_plan_id", executivePlanId)
      .eq("user_id", emp.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return t?.id ?? null;
  }

  function legacyFocusInTable(empId: string) {
    setOpen(false);
    if (onNavigateToEmployee) {
      onNavigateToEmployee(empId, executivePlanId);
      return;
    }
    window.setTimeout(() => {
      const pool = Array.from(document.querySelectorAll<HTMLElement>("[data-employee-target]"))
        .filter((el) => el.dataset.employeeTarget === empId && isVisibleTarget(el));
      if (pool.length === 0) {
        toast({
          title: "لم يُعثر على صفّ هذا الموظف",
          description: "لا يوجد صف ظاهر لهذا الموظف حالياً — جرّب إزالة فلاتر القسم أو الشهر.",
          variant: "destructive",
        });
        return;
      }
      const target = pool[0];
      centerTarget(target);
      target.classList.add("ring-4", "ring-[hsl(var(--primary))]", "ring-offset-2", "bg-[hsl(var(--primary)/0.12)]", "transition-shadow");
      window.setTimeout(() => {
        target.classList.remove("ring-4", "ring-[hsl(var(--primary))]", "ring-offset-2", "bg-[hsl(var(--primary)/0.12)]");
      }, 2200);
    }, 80);
  }

  const empById = new Map(allEmployees.map((e) => [e.id, e]));
  const availableToAdd = allEmployees.filter(
    (e) => e.id !== responsibleEmployeeId && !rows.find((r) => r.employee_id === e.id),
  );

  const count = rows.length;
  const isBusy = loading || autoGenerating;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={count > 0 ? `${count} موظف ذو علاقة` : "الموظفون ذوو العلاقة"}
          className={cn(
            "relative inline-flex items-center justify-center gap-1 h-6 px-2 rounded-full border text-[10px] font-bold transition-all shrink-0",
            count > 0
              ? "bg-gradient-to-l from-[hsl(var(--primary)/0.12)] to-[hsl(var(--accent)/0.08)] border-[hsl(var(--primary)/0.35)] text-[hsl(var(--primary))] hover:shadow-md"
              : "bg-slate-50 border-dashed border-slate-300 text-slate-500 hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]",
          )}
        >
          {isBusy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Users className="w-3 h-3" />
          )}
          <span>{count > 0 ? count : "+"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-[300px] p-2 bg-popover z-50"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1.5 text-[12px] font-bold text-slate-700 px-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              <span>الموظفون ذوو العلاقة</span>
            </div>
            {!showAddForm && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] gap-1 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)]"
                  onClick={handleGenerateRelations}
                  disabled={autoGenerating || !responsibleEmployeeId}
                >
                  {autoGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  اكتشاف
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] gap-1 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.08)]"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="w-3 h-3" />
                  إضافة
                </Button>
              </div>
            )}
          </div>

          {/* قائمة الموظفين */}
          {rows.length === 0 && !showAddForm && (
            <div className="text-[11px] text-slate-400 italic text-center py-3">
              لا يوجد موظفون ذوو علاقة لهذا النشاط
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
              {rows.map((r) => {
                const e = empById.get(r.employee_id);
                const name = e?.full_name ?? "موظف";
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "group flex items-center gap-2 px-2 py-1.5 rounded-md border text-[11px] transition-all",
                      r.source === "ai"
                        ? "bg-[hsl(var(--primary)/0.04)] border-[hsl(var(--primary)/0.2)]"
                        : "bg-slate-50 border-slate-200",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => navigateToEmployee(r.employee_id)}
                      disabled={navigatingEmpId === r.employee_id}
                      className="flex-1 flex items-center gap-2 text-right min-w-0 hover:text-[hsl(var(--primary))] transition-colors"
                      title="انتقل إلى مهمة هذا الموظف ضمن هذا النشاط"
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full text-white flex items-center justify-center text-[9px] font-bold shrink-0",
                          r.source === "ai"
                            ? "bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))]"
                            : "bg-slate-500",
                        )}
                      >
                        {name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 truncate flex items-center gap-1">
                          {name}
                          {r.source === "ai" && (
                            <Sparkles className="w-2.5 h-2.5 text-[hsl(var(--primary))] opacity-70" />
                          )}
                        </div>
                        {(r.role_in_activity || e?.department_name) && (
                          <div className="text-[9px] text-slate-500 truncate">
                            {r.role_in_activity || e?.department_name}
                          </div>
                        )}
                      </div>
                      {navigatingEmpId === r.employee_id ? (
                        <Loader2 className="w-3 h-3 text-[hsl(var(--primary))] shrink-0 animate-spin" />
                      ) : (
                        <ArrowLeft className="w-3 h-3 text-slate-400 group-hover:text-[hsl(var(--primary))] shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(r.id, r.employee_id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded-full shrink-0"
                      title="إزالة"
                    >
                      <X className="w-2.5 h-2.5 text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* نموذج الإضافة */}
          {showAddForm && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <Select value={addEmpId} onValueChange={setAddEmpId}>
                <SelectTrigger className="h-8 text-[11px]">
                  <SelectValue placeholder="اختر موظفاً..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-popover z-[60]">
                  {availableToAdd.length === 0 && (
                    <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                      لا يوجد متاح
                    </div>
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
                className="h-8 text-[11px]"
              />
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!addEmpId}
                  className="flex-1 h-7 text-[11px]"
                >
                  إضافة وترحيل المهام
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddEmpId("");
                    setAddRole("");
                  }}
                  className="h-7 text-[11px]"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}