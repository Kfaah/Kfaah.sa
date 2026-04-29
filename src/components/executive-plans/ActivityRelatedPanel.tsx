import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Send,
  Users,
  Clock3,
  ArrowRight,
  ArrowLeft,
  Save,
  Pencil,
  X,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Phase = "before" | "during" | "after";

interface Employee {
  id: string;
  full_name: string;
  job_title?: string | null;
  department_name?: string | null;
}

interface RelatedTask {
  id: string;
  executive_plan_id: string;
  employee_id: string;
  phase: Phase;
  title: string;
  description: string | null;
  estimated_minutes: number;
  priority: "low" | "medium" | "high";
  day_offset: number;
  display_order: number;
  source: "manual" | "ai";
  is_dispatched: boolean;
}

interface RelatedEmp {
  id: string;
  employee_id: string;
  role_in_activity: string | null;
  source: "manual" | "ai";
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
  open: boolean;
}

const PHASE_LABEL: Record<Phase, string> = {
  before: "قبل النشاط",
  during: "أثناء النشاط",
  after: "بعد النشاط",
};
const PHASE_COLOR: Record<Phase, string> = {
  before: "bg-blue-50 border-blue-200 text-blue-800",
  during: "bg-amber-50 border-amber-200 text-amber-800",
  after: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

export function ActivityRelatedPanel({
  executivePlanId,
  responsibleEmployeeId,
  responsibleEmployeeName,
  organizationId,
  activityName,
  activityDay,
  activityMonth,
  activityYear,
  open,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [tasks, setTasks] = useState<RelatedTask[]>([]);
  const [relatedEmps, setRelatedEmps] = useState<RelatedEmp[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [addEmpId, setAddEmpId] = useState<string>("");
  const [addEmpRole, setAddEmpRole] = useState<string>("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<RelatedTask>>({});
  const [showAddForm, setShowAddForm] = useState<{ employee_id: string; phase: Phase } | null>(null);
  const [newTaskDraft, setNewTaskDraft] = useState<Partial<RelatedTask>>({
    title: "",
    description: "",
    priority: "medium",
    estimated_minutes: 30,
    day_offset: 0,
  });

  useEffect(() => {
    if (!open) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, executivePlanId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [tasksRes, empsRes, allEmpRes] = await Promise.all([
        supabase
          .from("activity_related_tasks")
          .select("*")
          .eq("executive_plan_id", executivePlanId)
          .order("phase")
          .order("display_order"),
        supabase
          .from("activity_related_employees")
          .select("*")
          .eq("executive_plan_id", executivePlanId),
        organizationId
          ? supabase
              .from("employees")
              .select("id, full_name, job_title, departments(name)")
              .eq("organization_id", organizationId)
              .order("full_name")
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (empsRes.error) throw empsRes.error;
      setTasks((tasksRes.data ?? []) as RelatedTask[]);
      setRelatedEmps((empsRes.data ?? []) as RelatedEmp[]);
      setAllEmployees(
        ((allEmpRes.data ?? []) as any[]).map((e) => ({
          id: e.id,
          full_name: e.full_name,
          job_title: e.job_title,
          department_name: e.departments?.name ?? null,
        }))
      );
    } catch (e: any) {
      toast({ title: "خطأ في التحميل", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-related-tasks", {
        body: { executive_plan_id: executivePlanId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "تم التوليد بنجاح",
        description: `تم توليد ${(data as any).generated_count} مهمة بالذكاء الاصطناعي`,
      });
      // Auto-add suggested employees as manual proposals (visible for review)
      const suggestions = ((data as any).suggested_related_employees ?? []) as Array<{
        employee_id: string;
        role_in_activity: string;
      }>;
      const existingIds = new Set([
        ...(responsibleEmployeeId ? [responsibleEmployeeId] : []),
        ...relatedEmps.map((r) => r.employee_id),
      ]);
      const toInsert = suggestions
        .filter((s) => !existingIds.has(s.employee_id))
        .map((s) => ({
          executive_plan_id: executivePlanId,
          employee_id: s.employee_id,
          role_in_activity: s.role_in_activity,
          source: "ai" as const,
          organization_id: organizationId,
        }));
      if (toInsert.length > 0) {
        await supabase.from("activity_related_employees").insert(toInsert);
      }
      await loadAll();
    } catch (e: any) {
      toast({ title: "تعذّر التوليد", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddEmployee() {
    if (!addEmpId) return;
    try {
      const { error } = await supabase.from("activity_related_employees").insert({
        executive_plan_id: executivePlanId,
        employee_id: addEmpId,
        role_in_activity: addEmpRole || null,
        source: "manual",
        organization_id: organizationId,
      });
      if (error) throw error;
      setAddEmpId("");
      setAddEmpRole("");
      await loadAll();
      toast({ title: "تم إضافة الموظف ذي العلاقة" });
    } catch (e: any) {
      toast({ title: "تعذّر الإضافة", description: e.message, variant: "destructive" });
    }
  }

  async function handleRemoveRelatedEmp(rid: string) {
    if (!confirm("حذف هذا الموظف وجميع مهامه التابعة لهذا النشاط؟")) return;
    const re = relatedEmps.find((r) => r.id === rid);
    if (!re) return;
    try {
      // Delete tasks for this related employee under this activity (not yet dispatched)
      await supabase
        .from("activity_related_tasks")
        .delete()
        .eq("executive_plan_id", executivePlanId)
        .eq("employee_id", re.employee_id)
        .eq("is_dispatched", false);
      await supabase.from("activity_related_employees").delete().eq("id", rid);
      await loadAll();
    } catch (e: any) {
      toast({ title: "تعذّر الحذف", description: e.message, variant: "destructive" });
    }
  }

  async function handleSaveTaskEdit() {
    if (!editingTaskId) return;
    try {
      const { error } = await supabase
        .from("activity_related_tasks")
        .update({
          title: editDraft.title,
          description: editDraft.description ?? null,
          estimated_minutes: editDraft.estimated_minutes,
          priority: editDraft.priority,
          day_offset: editDraft.day_offset,
        })
        .eq("id", editingTaskId);
      if (error) throw error;
      setEditingTaskId(null);
      setEditDraft({});
      await loadAll();
    } catch (e: any) {
      toast({ title: "تعذّر الحفظ", description: e.message, variant: "destructive" });
    }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm("حذف هذه المهمة؟")) return;
    try {
      await supabase.from("activity_related_tasks").delete().eq("id", id);
      await loadAll();
    } catch (e: any) {
      toast({ title: "تعذّر الحذف", description: e.message, variant: "destructive" });
    }
  }

  async function handleAddManualTask() {
    if (!showAddForm || !newTaskDraft.title?.trim()) {
      toast({ title: "أدخل عنوان المهمة", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("activity_related_tasks").insert({
        executive_plan_id: executivePlanId,
        employee_id: showAddForm.employee_id,
        phase: showAddForm.phase,
        title: newTaskDraft.title.trim(),
        description: newTaskDraft.description?.trim() || null,
        estimated_minutes: newTaskDraft.estimated_minutes ?? 30,
        priority: (newTaskDraft.priority as any) ?? "medium",
        day_offset: newTaskDraft.day_offset ?? 0,
        source: "manual",
        organization_id: organizationId,
      });
      if (error) throw error;
      setShowAddForm(null);
      setNewTaskDraft({ title: "", description: "", priority: "medium", estimated_minutes: 30, day_offset: 0 });
      await loadAll();
    } catch (e: any) {
      toast({ title: "تعذّر الإضافة", description: e.message, variant: "destructive" });
    }
  }

  async function handleDispatchAll() {
    const pending = tasks.filter((t) => !t.is_dispatched);
    if (pending.length === 0) {
      toast({ title: "لا توجد مهام للترحيل" });
      return;
    }
    if (!confirm(`ترحيل ${pending.length} مهمة إلى لوحة المهام للموظفين؟`)) return;
    setDispatching(true);
    try {
      // Build base date
      const baseDate = new Date(activityYear, activityMonth - 1, activityDay);
      const empById = new Map(allEmployees.map((e) => [e.id, e]));
      // Need user_id per employee for tasks.user_id
      const empIds = Array.from(new Set(pending.map((t) => t.employee_id)));
      const { data: empWithUser } = await supabase
        .from("employees")
        .select("id, user_id")
        .in("id", empIds);
      const userByEmp = new Map<string, string | null>(
        (empWithUser ?? []).map((e: any) => [e.id, e.user_id])
      );

      const skipped: string[] = [];
      for (const t of pending) {
        const userId = userByEmp.get(t.employee_id);
        if (!userId) {
          skipped.push(empById.get(t.employee_id)?.full_name ?? t.employee_id);
          continue;
        }
        const due = new Date(baseDate);
        due.setDate(due.getDate() + t.day_offset);
        const dueStr = due.toISOString().slice(0, 10);
        const { data: ins, error: insErr } = await supabase
          .from("tasks")
          .insert({
            title: `[${PHASE_LABEL[t.phase]}] ${t.title}`,
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
          })
          .select("id")
          .maybeSingle();
        if (insErr) {
          console.error(insErr);
          continue;
        }
        await supabase
          .from("activity_related_tasks")
          .update({ is_dispatched: true, dispatched_task_id: ins?.id ?? null })
          .eq("id", t.id);
      }
      await loadAll();
      toast({
        title: "تم الترحيل",
        description:
          skipped.length > 0
            ? `تم ترحيل المهام. تم تخطي موظفين بدون حساب: ${skipped.join("، ")}`
            : "تم ترحيل جميع المهام إلى لوحات الموظفين",
      });
    } catch (e: any) {
      toast({ title: "تعذّر الترحيل", description: e.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  }

  if (!open) return null;

  // Build employees list to display: responsible + related
  const empList: Employee[] = [];
  if (responsibleEmployeeId) {
    const found = allEmployees.find((e) => e.id === responsibleEmployeeId);
    empList.push(
      found ?? { id: responsibleEmployeeId, full_name: responsibleEmployeeName }
    );
  }
  for (const r of relatedEmps) {
    if (empList.find((e) => e.id === r.employee_id)) continue;
    const found = allEmployees.find((e) => e.id === r.employee_id);
    if (found) empList.push(found);
  }

  const availableToAdd = allEmployees.filter(
    (e) => e.id !== responsibleEmployeeId && !relatedEmps.find((r) => r.employee_id === e.id)
  );

  const totalPending = tasks.filter((t) => !t.is_dispatched).length;
  const totalDispatched = tasks.filter((t) => t.is_dispatched).length;

  return (
    <Card className="mt-2 p-3 bg-gradient-to-br from-slate-50 to-white border-2 border-[hsl(var(--primary)/0.2)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[hsl(var(--primary))]" />
          <span className="text-xs font-bold text-slate-700">المهام والموظفون ذوو العلاقة</span>
          {totalPending > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
              {totalPending} في الانتظار
            </Badge>
          )}
          {totalDispatched > 0 && (
            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
              <CheckCircle2 className="w-2.5 h-2.5 ml-1" />
              {totalDispatched} مُرحَّلة
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || loading}
            className="h-7 text-[11px] gap-1.5 border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))]"
          >
            {generating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            توليد بالذكاء الاصطناعي
          </Button>
          {totalPending > 0 && (
            <Button
              size="sm"
              onClick={handleDispatchAll}
              disabled={dispatching}
              className="h-7 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {dispatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              ترحيل إلى المهام ({totalPending})
            </Button>
          )}
        </div>
      </div>

      {/* Add related employee */}
      <div className="flex flex-wrap items-end gap-2 mb-3 p-2 bg-white rounded-md border border-slate-200">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
            إضافة موظف ذي علاقة
          </label>
          <Select value={addEmpId} onValueChange={setAddEmpId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="اختر موظفاً..." />
            </SelectTrigger>
            <SelectContent className="max-h-72 bg-popover">
              {availableToAdd.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">لا يوجد متاح</div>
              )}
              {availableToAdd.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name}
                  {e.department_name ? ` — ${e.department_name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="text-[10px] font-semibold text-slate-600 mb-0.5 block">
            دوره في النشاط (اختياري)
          </label>
          <Input
            value={addEmpRole}
            onChange={(e) => setAddEmpRole(e.target.value)}
            className="h-8 text-xs"
            placeholder="مثال: التوثيق، التنسيق..."
          />
        </div>
        <Button size="sm" onClick={handleAddEmployee} disabled={!addEmpId} className="h-8 gap-1 text-xs">
          <Plus className="w-3 h-3" />
          إضافة
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--primary))]" />
        </div>
      )}

      {/* Employees & their tasks */}
      {!loading && empList.length === 0 && (
        <div className="text-center py-4 text-xs text-slate-500">
          لا يوجد موظف مسؤول. أضف موظفاً ذا علاقة لبدء توليد المهام.
        </div>
      )}

      {!loading && empList.map((emp) => {
        const isResponsible = emp.id === responsibleEmployeeId;
        const relatedRow = relatedEmps.find((r) => r.employee_id === emp.id);
        const empTasks = tasks.filter((t) => t.employee_id === emp.id);
        const phases: Phase[] = ["before", "during", "after"];
        return (
          <div key={emp.id} className="mb-3 last:mb-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                  {emp.full_name.charAt(0)}
                </div>
                <span className="text-xs font-bold text-slate-800 truncate">{emp.full_name}</span>
                {isResponsible ? (
                  <Badge className="text-[9px] bg-[hsl(var(--primary))] text-white">المسؤول</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px]">
                    {relatedRow?.role_in_activity || "ذو علاقة"}
                    {relatedRow?.source === "ai" && " · AI"}
                  </Badge>
                )}
                {emp.department_name && (
                  <span className="text-[10px] text-slate-500 truncate">— {emp.department_name}</span>
                )}
              </div>
              {!isResponsible && relatedRow && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveRelatedEmp(relatedRow.id)}
                  className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {phases.map((phase) => {
                const phTasks = empTasks.filter((t) => t.phase === phase);
                const isAdding =
                  showAddForm?.employee_id === emp.id && showAddForm?.phase === phase;
                return (
                  <div
                    key={phase}
                    className={cn(
                      "rounded-md border p-2 min-h-[80px]",
                      PHASE_COLOR[phase]
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        {phase === "before" && <ArrowRight className="w-3 h-3" />}
                        {phase === "during" && <Clock3 className="w-3 h-3" />}
                        {phase === "after" && <ArrowLeft className="w-3 h-3" />}
                        {PHASE_LABEL[phase]}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => {
                          setShowAddForm({ employee_id: emp.id, phase });
                          setNewTaskDraft({
                            title: "",
                            description: "",
                            priority: "medium",
                            estimated_minutes: 30,
                            day_offset: phase === "before" ? -1 : phase === "after" ? 1 : 0,
                          });
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {phTasks.length === 0 && !isAdding && (
                      <div className="text-[10px] text-slate-500 py-2 text-center">— فارغ —</div>
                    )}

                    {phTasks.map((t) => {
                      const isEditing = editingTaskId === t.id;
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            "bg-white rounded-md border p-1.5 mb-1 text-[11px]",
                            t.is_dispatched ? "border-emerald-300 opacity-75" : "border-slate-200"
                          )}
                        >
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <Input
                                value={editDraft.title ?? ""}
                                onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                                className="h-7 text-xs"
                                placeholder="عنوان المهمة"
                              />
                              <Textarea
                                value={editDraft.description ?? ""}
                                onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                                className="text-xs min-h-[40px]"
                                placeholder="وصف"
                              />
                              <div className="grid grid-cols-3 gap-1">
                                <Input
                                  type="number"
                                  value={editDraft.estimated_minutes ?? 30}
                                  onChange={(e) =>
                                    setEditDraft({ ...editDraft, estimated_minutes: parseInt(e.target.value) || 30 })
                                  }
                                  className="h-7 text-xs"
                                  placeholder="دقائق"
                                />
                                <Select
                                  value={(editDraft.priority as string) ?? "medium"}
                                  onValueChange={(v) => setEditDraft({ ...editDraft, priority: v as any })}
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover">
                                    <SelectItem value="low">منخفض</SelectItem>
                                    <SelectItem value="medium">متوسط</SelectItem>
                                    <SelectItem value="high">عالي</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  value={editDraft.day_offset ?? 0}
                                  onChange={(e) =>
                                    setEditDraft({ ...editDraft, day_offset: parseInt(e.target.value) || 0 })
                                  }
                                  className="h-7 text-xs"
                                  placeholder="إزاحة أيام"
                                />
                              </div>
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveTaskEdit}>
                                  <Save className="w-3 h-3 text-emerald-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setEditingTaskId(null);
                                    setEditDraft({});
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-semibold text-slate-800 leading-snug flex-1">
                                  {t.title}
                                </span>
                                {!t.is_dispatched && (
                                  <div className="flex gap-0.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5"
                                      onClick={() => {
                                        setEditingTaskId(t.id);
                                        setEditDraft(t);
                                      }}
                                    >
                                      <Pencil className="w-2.5 h-2.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 text-rose-500"
                                      onClick={() => handleDeleteTask(t.id)}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                )}
                                {t.is_dispatched && (
                                  <Badge variant="outline" className="text-[8px] border-emerald-400 text-emerald-700 shrink-0">
                                    <CheckCircle2 className="w-2 h-2 ml-0.5" />
                                    مُرحَّلة
                                  </Badge>
                                )}
                              </div>
                              {t.description && (
                                <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">{t.description}</div>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1 text-[9px]">
                                <Badge variant="outline" className="text-[9px] py-0">
                                  {t.estimated_minutes}د
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] py-0",
                                    t.priority === "high" && "border-rose-400 text-rose-700",
                                    t.priority === "medium" && "border-amber-400 text-amber-700",
                                    t.priority === "low" && "border-slate-400 text-slate-700"
                                  )}
                                >
                                  {t.priority === "high" ? "عالي" : t.priority === "medium" ? "متوسط" : "منخفض"}
                                </Badge>
                                {t.day_offset !== 0 && (
                                  <Badge variant="outline" className="text-[9px] py-0">
                                    {t.day_offset > 0 ? `+${t.day_offset}ي` : `${t.day_offset}ي`}
                                  </Badge>
                                )}
                                {t.source === "ai" && (
                                  <Badge variant="outline" className="text-[9px] py-0 border-purple-300 text-purple-700">
                                    <Sparkles className="w-2 h-2 ml-0.5" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {isAdding && (
                      <div className="bg-white rounded-md border border-amber-300 p-1.5 space-y-1.5">
                        <Input
                          value={newTaskDraft.title ?? ""}
                          onChange={(e) => setNewTaskDraft({ ...newTaskDraft, title: e.target.value })}
                          className="h-7 text-xs"
                          placeholder="عنوان المهمة"
                          autoFocus
                        />
                        <Textarea
                          value={newTaskDraft.description ?? ""}
                          onChange={(e) => setNewTaskDraft({ ...newTaskDraft, description: e.target.value })}
                          className="text-xs min-h-[40px]"
                          placeholder="وصف (اختياري)"
                        />
                        <div className="grid grid-cols-3 gap-1">
                          <Input
                            type="number"
                            value={newTaskDraft.estimated_minutes ?? 30}
                            onChange={(e) =>
                              setNewTaskDraft({ ...newTaskDraft, estimated_minutes: parseInt(e.target.value) || 30 })
                            }
                            className="h-7 text-xs"
                            placeholder="دقائق"
                          />
                          <Select
                            value={(newTaskDraft.priority as string) ?? "medium"}
                            onValueChange={(v) => setNewTaskDraft({ ...newTaskDraft, priority: v as any })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="low">منخفض</SelectItem>
                              <SelectItem value="medium">متوسط</SelectItem>
                              <SelectItem value="high">عالي</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={newTaskDraft.day_offset ?? 0}
                            onChange={(e) =>
                              setNewTaskDraft({ ...newTaskDraft, day_offset: parseInt(e.target.value) || 0 })
                            }
                            className="h-7 text-xs"
                            placeholder="إزاحة أيام"
                          />
                        </div>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-6 text-[10px] gap-1" onClick={handleAddManualTask}>
                            <Save className="w-3 h-3" />
                            حفظ
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px]"
                            onClick={() => setShowAddForm(null)}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}