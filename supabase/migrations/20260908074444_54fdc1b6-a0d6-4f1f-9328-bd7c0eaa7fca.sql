GRANT EXECUTE ON FUNCTION public.can_manage_employee_file(uuid) TO authenticated;

DROP POLICY IF EXISTS "Org admins can insert org employee files" ON public.employee_files;
CREATE POLICY "Org admins can insert org employee files"
ON public.employee_files FOR INSERT TO authenticated
WITH CHECK (public.can_manage_employee_file(user_id));

DROP POLICY IF EXISTS "Org admins can delete org employee files" ON public.employee_files;
CREATE POLICY "Org admins can delete org employee files"
ON public.employee_files FOR DELETE TO authenticated
USING (public.can_manage_employee_file(user_id));