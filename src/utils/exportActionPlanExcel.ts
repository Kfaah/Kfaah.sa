import * as XLSX from "xlsx";

type SubTask = {
  title: string;
  details: string;
  duration_days: number;
  done?: boolean;
};

type Plan = {
  title: string;
  description: string | null;
  org_name?: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  progress: number;
};

type Task = {
  title: string;
  description: string | null;
  impact: string;
  status: string;
  start_date: string | null;
  due_date: string | null;
  assigned_employee_id: string | null;
  completion_notes: string | null;
  subtasks: SubTask[] | null;
};

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

const formatDate = (value: string | null) => value || "—";

function buildSheet(rows: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0].map((_, index) => ({
    wch: [26, 18, 18, 20, 22, 18, 18, 18, 16, 40][index] || 22,
  }));
  return sheet;
}

export function exportActionPlanExcel({
  plan,
  tasks,
  employees,
}: {
  plan: Plan;
  tasks: Task[];
  employees: { id: string; full_name: string; job_role: string }[];
}) {
  const employeeNameById = new Map(employees.map((employee) => [employee.id, employee.full_name]));

  const summaryRows = [
    ["الحقل", "القيمة"],
    ["الجهة", plan.org_name || "—"],
    ["عنوان الخطة", plan.title],
    ["وصف الخطة", plan.description || "—"],
    ["الحالة", STATUS_LABEL[plan.status] || plan.status],
    ["الفترة", `${formatDate(plan.start_date)} → ${formatDate(plan.end_date)}`],
    ["نسبة الإنجاز", `${Math.round(plan.progress || 0)}%`],
    ["عدد المهام الرئيسية", tasks.length],
    ["عدد المهام التنفيذية", tasks.reduce((sum, task) => sum + (task.subtasks?.length || 0), 0)],
  ];

  const taskRows = [
    ["المهمة الرئيسية", "الشرح", "المكلف", "الفترة", "الحالة", "الأثر", "ملاحظات الإنجاز", "عدد المهام التنفيذية"],
    ...tasks.map((task) => [
      task.title,
      task.description || "—",
      task.assigned_employee_id ? employeeNameById.get(task.assigned_employee_id) || "—" : "غير مكلّف",
      `${formatDate(task.start_date)} → ${formatDate(task.due_date)}`,
      STATUS_LABEL[task.status] || task.status,
      IMPACT_LABEL[task.impact] || task.impact,
      task.completion_notes || "—",
      task.subtasks?.length || 0,
    ]),
  ];

  const executiveRows = [
    ["المهمة الرئيسية", "المهمة التنفيذية", "التفاصيل", "المكلف", "الفترة العامة", "الحالة", "المدة بالأيام"],
    ...tasks.flatMap((task) => {
      const assignee = task.assigned_employee_id ? employeeNameById.get(task.assigned_employee_id) || "—" : "غير مكلّف";
      const period = `${formatDate(task.start_date)} → ${formatDate(task.due_date)}`;

      if (!task.subtasks?.length) {
        return [[task.title, "—", "لا توجد مهام تنفيذية مولدة بعد", assignee, period, STATUS_LABEL[task.status] || task.status, "—"]];
      }

      return task.subtasks.map((subtask) => [
        task.title,
        subtask.title,
        subtask.details,
        assignee,
        period,
        subtask.done ? "منجزة" : STATUS_LABEL[task.status] || task.status,
        subtask.duration_days,
      ]);
    }),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildSheet(summaryRows), "ملخص الخطة");
  XLSX.utils.book_append_sheet(workbook, buildSheet(taskRows), "المهام الرئيسية");
  XLSX.utils.book_append_sheet(workbook, buildSheet(executiveRows), "المهام التنفيذية");

  const fileName = `${(plan.title || "action-plan").replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
}