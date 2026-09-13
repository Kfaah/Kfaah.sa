-- Scope admin policies to the admin's own organization
DROP POLICY IF EXISTS "Admins manage related employees" ON public.activity_related_employees;
CREATE POLICY "Admins manage related employees"
ON public.activity_related_employees
FOR ALL TO public
USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())))
WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Admins manage related tasks" ON public.activity_related_tasks;
CREATE POLICY "Admins manage related tasks"
ON public.activity_related_tasks
FOR ALL TO public
USING (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())))
WITH CHECK (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())));

DROP POLICY IF EXISTS "Assigned users update smart tasks" ON public.smart_tasks;
CREATE POLICY "Assigned users update smart tasks"
ON public.smart_tasks
FOR UPDATE TO public
USING (assigned_to = auth.uid() OR (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())));