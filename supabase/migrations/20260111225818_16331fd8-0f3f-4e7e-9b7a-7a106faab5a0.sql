-- إضافة سياسة للسماح لجميع المستخدمين المسجلين بمشاهدة بيانات المدراء
CREATE POLICY "Anyone can view admin employees"
ON public.employees
FOR SELECT
USING (
  user_id IN (
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
  )
);