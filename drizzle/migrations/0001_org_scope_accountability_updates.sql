DROP POLICY IF EXISTS acc_q_employee_update ON public.accountability_questions;
CREATE POLICY acc_q_employee_update ON public.accountability_questions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = accountability_questions.target_employee_id
      AND e.user_id = auth.uid()
      AND e.organization_id = accountability_questions.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = accountability_questions.target_employee_id
      AND e.user_id = auth.uid()
      AND e.organization_id = accountability_questions.organization_id
  )
);

DROP POLICY IF EXISTS acc_tasks_employee_update ON public.accountability_tasks;
CREATE POLICY acc_tasks_employee_update ON public.accountability_tasks
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = accountability_tasks.assigned_employee_id
      AND e.user_id = auth.uid()
      AND e.organization_id = accountability_tasks.organization_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = accountability_tasks.assigned_employee_id
      AND e.user_id = auth.uid()
      AND e.organization_id = accountability_tasks.organization_id
  )
);