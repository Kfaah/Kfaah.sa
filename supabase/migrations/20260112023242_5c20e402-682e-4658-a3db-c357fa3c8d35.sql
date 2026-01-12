-- إضافة أعمدة للنماذج المخصصة في جدول أنواع الطلبات
ALTER TABLE public.hr_request_types
ADD COLUMN IF NOT EXISTS letterhead_url text,
ADD COLUMN IF NOT EXISTS header_text text DEFAULT 'صاحب السعادة المدير العام    حفظه الله',
ADD COLUMN IF NOT EXISTS greeting_text text DEFAULT 'السلام عليكم ورحمة الله وبركاته، وبعد:',
ADD COLUMN IF NOT EXISTS body_template text,
ADD COLUMN IF NOT EXISTS closing_text text DEFAULT 'آمل من سعادتكم التكرم بالموافقة على طلبي.
وتقبلوا فائق الاحترام والتقدير،،،',
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS workflow_stages jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS show_dates boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_reason boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_notes boolean DEFAULT true;

-- جدول مراحل سير العمل للطلبات
CREATE TABLE IF NOT EXISTS public.hr_workflow_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_type_id uuid NOT NULL REFERENCES public.hr_request_types(id) ON DELETE CASCADE,
  stage_order integer NOT NULL DEFAULT 1,
  stage_name text NOT NULL,
  approver_role text, -- admin, moderator, specific_user
  approver_user_id uuid, -- إذا كان المعتمد شخص محدد
  is_required boolean DEFAULT true,
  can_reject boolean DEFAULT true,
  auto_approve_after_days integer, -- موافقة تلقائية بعد عدد أيام
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- جدول تتبع مراحل الموافقة لكل طلب
CREATE TABLE IF NOT EXISTS public.hr_request_workflow (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.hr_requests(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.hr_workflow_stages(id),
  stage_order integer NOT NULL,
  stage_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected, skipped
  assigned_to uuid,
  action_by uuid,
  action_at timestamp with time zone,
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- إضافة عمود للحقول المخصصة في الطلبات
ALTER TABLE public.hr_requests
ADD COLUMN IF NOT EXISTS custom_field_values jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS current_stage integer DEFAULT 1;

-- تفعيل RLS
ALTER TABLE public.hr_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_request_workflow ENABLE ROW LEVEL SECURITY;

-- سياسات hr_workflow_stages
CREATE POLICY "Anyone can view workflow stages"
ON public.hr_workflow_stages FOR SELECT
USING (true);

CREATE POLICY "Admins can manage workflow stages"
ON public.hr_workflow_stages FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات hr_request_workflow
CREATE POLICY "Users can view own request workflow"
ON public.hr_request_workflow FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hr_requests r
    WHERE r.id = hr_request_workflow.request_id
    AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all request workflows"
ON public.hr_request_workflow FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage request workflows"
ON public.hr_request_workflow FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Assigned users can update workflow"
ON public.hr_request_workflow FOR UPDATE
USING (assigned_to = auth.uid());

-- إنشاء bucket للقوالب إذا لم يكن موجوداً
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-templates', 'hr-templates', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات التخزين للقوالب
CREATE POLICY "Anyone can view hr templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr-templates');

CREATE POLICY "Admins can upload hr templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hr-templates'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update hr templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'hr-templates'
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete hr templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'hr-templates'
  AND has_role(auth.uid(), 'admin'::app_role)
);