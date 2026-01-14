-- إضافة حقول المدير المباشر والمدير التنفيذي لجدول الموظفين
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS direct_manager_id uuid REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS executive_manager_id uuid REFERENCES public.employees(id);

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN public.employees.direct_manager_id IS 'المدير المباشر للموظف';
COMMENT ON COLUMN public.employees.executive_manager_id IS 'المدير التنفيذي للموظف';