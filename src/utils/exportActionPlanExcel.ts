type SubTask = {
  title: string;
  details: string;
  duration_days: number;
  done?: boolean;
  status?: string;
  assigned_employee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  deliverable?: {
    type: string;
    title: string;
    content: string;
  } | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  employee_report?: string | null;
  report_file_url?: string | null;
  report_file_name?: string | null;
  rating?: number | null;
  rating_notes?: string | null;
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

const formatDate = (value: string | null | undefined) => value || "—";

function buildSheet(
  XLSX: typeof import("xlsx"),
  rows: (string | number)[][],
  widths: number[],
) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = rows[0].map((_, index) => ({ wch: widths[index] || 22 }));
  // RTL
  (sheet as any)["!views"] = [{ RTL: true }];
  // Style header row (bold) — best-effort, xlsx community edition has limited styling
  const headerRange = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (sheet[addr]) {
      sheet[addr].s = { font: { bold: true } };
    }
  }
  return sheet;
}

export async function exportActionPlanExcel({
  plan,
  tasks,
  employees,
}: {
  plan: Plan;
  tasks: Task[];
  employees: { id: string; full_name: string; job_role: string }[];
}) {
  const XLSX = await import("xlsx");
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

  const taskRows: (string | number)[][] = [
    ["#", "المهمة الرئيسية", "الشرح", "المكلف", "تاريخ البدء", "تاريخ الاستحقاق", "الحالة", "الأثر", "ملاحظات الإنجاز", "عدد المهام التنفيذية"],
    ...tasks.map((task, i) => [
      i + 1,
      task.title,
      task.description || "—",
      task.assigned_employee_id ? employeeNameById.get(task.assigned_employee_id) || "—" : "غير مكلّف",
      formatDate(task.start_date),
      formatDate(task.due_date),
      STATUS_LABEL[task.status] || task.status,
      IMPACT_LABEL[task.impact] || task.impact,
      task.completion_notes || "—",
      task.subtasks?.length || 0,
    ]),
  ];

  const executiveRows: (string | number)[][] = [
    [
      "#",
      "الهدف الرئيسي",
      "المهمة التنفيذية",
      "التفاصيل",
      "المكلف",
      "تاريخ البدء",
      "تاريخ الاستحقاق",
      "المدة (أيام)",
      "الحالة",
      "المخرج الجاهز",
      "رابط المادة الداعمة",
      "تقرير الموظف",
      "ملف التقرير",
      "التقييم",
      "ملاحظة التقييم",
    ],
    ...tasks.flatMap((task, ti) => {
      const assignee = task.assigned_employee_id ? employeeNameById.get(task.assigned_employee_id) || "—" : "غير مكلّف";
      if (!task.subtasks?.length) {
        return [[
          `${ti + 1}`,
          task.title,
          "—",
          "لا توجد مهام تنفيذية مولدة بعد",
          assignee,
          "—", "—", "—",
          STATUS_LABEL[task.status] || task.status,
          "—", "—", "—", "—", "—", "—",
        ]];
      }
      return task.subtasks.map((subtask, si) => [
        `${ti + 1}.${si + 1}`,
        task.title,
        subtask.title,
        subtask.details,
        subtask.assigned_employee_id
          ? employeeNameById.get(subtask.assigned_employee_id) || "—"
          : assignee,
        formatDate(subtask.start_date),
        formatDate(subtask.due_date),
        subtask.duration_days,
        STATUS_LABEL[subtask.status || (subtask.done ? "completed" : task.status)] || task.status,
        subtask.deliverable ? `[${subtask.deliverable.title}]\n${subtask.deliverable.content}` : "—",
        subtask.attachment_url || "—",
        subtask.employee_report || "—",
        subtask.report_file_url || "—",
        subtask.rating ? `${subtask.rating}/5` : "—",
        subtask.rating_notes || "—",
      ]);
    }),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(XLSX, summaryRows, [22, 60]),
    "ملخص الخطة",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(XLSX, taskRows, [5, 32, 50, 22, 14, 14, 16, 12, 40, 14]),
    "المهام الرئيسية",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(XLSX, executiveRows, [7, 28, 28, 50, 22, 14, 14, 12, 16, 50, 40, 40, 40, 12, 30]),
    "المهام التنفيذية",
  );

  // Set workbook to RTL by default
  (workbook as any).Workbook = { Views: [{ RTL: true }] };

  const fileName = `${(plan.title || "action-plan").replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;
  XLSX.writeFile(workbook, fileName, { compression: true });
}