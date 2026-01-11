-- إضافة سياسة للسماح للجميع بعرض أدوار المستخدمين (للبحث عن المدراء)
CREATE POLICY "Anyone can view admin roles"
ON public.user_roles
FOR SELECT
USING (role = 'admin');