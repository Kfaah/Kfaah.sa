-- إضافة أعمدة للموظف البديل والمدير المباشر مع حالة الموافقة
ALTER TABLE public.hr_requests
ADD COLUMN IF NOT EXISTS substitute_employee_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS substitute_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS substitute_approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS direct_manager_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS manager_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manager_approved_at timestamp with time zone;