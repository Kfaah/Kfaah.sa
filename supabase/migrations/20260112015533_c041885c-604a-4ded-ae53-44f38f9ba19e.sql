-- إضافة سياسة للسماح للمدراء بإنشاء طلبات للموظفين
CREATE POLICY "Admins can create requests for any user"
ON public.hr_requests
FOR INSERT
TO public
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));