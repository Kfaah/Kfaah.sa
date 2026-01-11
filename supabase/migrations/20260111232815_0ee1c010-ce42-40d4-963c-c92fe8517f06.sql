-- السماح لجميع المستخدمين المسجلين برؤية جميع الموظفين للمراسلة
CREATE POLICY "Authenticated users can view employees for messaging"
ON public.employees
FOR SELECT
TO authenticated
USING (true);