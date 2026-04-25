-- 1) Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-duties-files', 'staff-duties-files', false)
ON CONFLICT (id) DO NOTHING;

-- 2) Imports tracking table
CREATE TABLE public.staff_duties_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | success | failed | partial
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_duties INTEGER NOT NULL DEFAULT 0,
  matched_employees INTEGER NOT NULL DEFAULT 0,
  unmatched_rows INTEGER NOT NULL DEFAULT 0,
  sheet_summary JSONB,
  error_log JSONB,
  ai_notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_duties_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage org duty imports"
ON public.staff_duties_imports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Super admin all duty imports"
ON public.staff_duties_imports FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_staff_duties_imports_updated_at
BEFORE UPDATE ON public.staff_duties_imports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staff_duties_imports_org ON public.staff_duties_imports(organization_id);

-- 3) Extend employee_job_duties to link back to imports
ALTER TABLE public.employee_job_duties
  ADD COLUMN IF NOT EXISTS import_id UUID,
  ADD COLUMN IF NOT EXISTS source_sheet TEXT,
  ADD COLUMN IF NOT EXISTS source_row INTEGER,
  ADD COLUMN IF NOT EXISTS external_employee_ref TEXT,
  ADD COLUMN IF NOT EXISTS raw_data JSONB;

CREATE INDEX IF NOT EXISTS idx_employee_job_duties_import ON public.employee_job_duties(import_id);

-- 4) Storage RLS for the bucket
CREATE POLICY "Admins read staff duties files"
ON storage.objects FOR SELECT
USING (bucket_id = 'staff-duties-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins upload staff duties files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'staff-duties-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update staff duties files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'staff-duties-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete staff duties files"
ON storage.objects FOR DELETE
USING (bucket_id = 'staff-duties-files' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admin all staff duties files"
ON storage.objects FOR ALL
USING (bucket_id = 'staff-duties-files' AND is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'staff-duties-files' AND is_super_admin(auth.uid()));