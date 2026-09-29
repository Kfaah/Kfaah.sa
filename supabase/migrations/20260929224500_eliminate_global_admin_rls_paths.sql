-- Eliminate the remaining global-admin RLS paths on organization-scoped tables.

DROP POLICY IF EXISTS "Admins manage related employees"
  ON public.activity_related_employees;
CREATE POLICY "Admins manage related employees"
ON public.activity_related_employees
FOR ALL TO authenticated
USING (
  public.admin_can_access_org(organization_id)
)
WITH CHECK (
  public.admin_can_access_org(organization_id)
);

DROP POLICY IF EXISTS "Admins manage related tasks"
  ON public.activity_related_tasks;
CREATE POLICY "Admins manage related tasks"
ON public.activity_related_tasks
FOR ALL TO authenticated
USING (
  public.admin_can_access_org(organization_id)
)
WITH CHECK (
  public.admin_can_access_org(organization_id)
);

DROP POLICY IF EXISTS "Assigned users update smart tasks"
  ON public.smart_tasks;
CREATE POLICY "Assigned users update smart tasks"
ON public.smart_tasks
FOR UPDATE TO authenticated
USING (
  (
    assigned_to = auth.uid()
    AND public.user_belongs_to_org(auth.uid(), organization_id)
  )
  OR public.admin_can_access_org(organization_id)
)
WITH CHECK (
  (
    assigned_to = auth.uid()
    AND public.user_belongs_to_org(auth.uid(), organization_id)
  )
  OR public.admin_can_access_org(organization_id)
);
