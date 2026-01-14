-- إضافة الأعمدة الخاصة بموافقة مدير الموارد البشرية إذا لم تكن موجودة
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_requests' AND column_name = 'hr_manager_id') THEN
    ALTER TABLE public.hr_requests ADD COLUMN hr_manager_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_requests' AND column_name = 'hr_manager_approved') THEN
    ALTER TABLE public.hr_requests ADD COLUMN hr_manager_approved boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_requests' AND column_name = 'hr_manager_approved_at') THEN
    ALTER TABLE public.hr_requests ADD COLUMN hr_manager_approved_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hr_requests' AND column_name = 'workflow_stage') THEN
    ALTER TABLE public.hr_requests ADD COLUMN workflow_stage integer DEFAULT 1;
  END IF;
END
$$;