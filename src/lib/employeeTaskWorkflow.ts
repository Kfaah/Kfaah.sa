type WorkflowTask = { status: string; due_date: string | null };

/** An undated or already started task remains actionable; future tasks wait. */
export function employeeTaskStatuses(task: WorkflowTask, now = new Date()): string[] {
  if (task.status === "completed") return [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const actionable = !task.due_date || task.due_date.slice(0, 10) <= today || task.status === "in_progress";
  return actionable ? ["upcoming", "in_progress", "executed"] : [];
}

/** A zero-row/denied update must never be shown as a successful state change. */
export async function requireSavedTask<T>(request: PromiseLike<{data: T | null; error: {message: string} | null}>): Promise<T> {
  const {data, error} = await request;
  if (error) throw new Error(error.message);
  if (!data) throw new Error("تعذر حفظ المهمة. أعد تحميل الصفحة ثم حاول مرة أخرى.");
  return data;
}
