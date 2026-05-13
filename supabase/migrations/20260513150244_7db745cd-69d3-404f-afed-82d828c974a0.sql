-- جدول سجلات النسخ الاحتياطي إلى GitHub
CREATE TABLE public.backup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled')),
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- إحصائيات
  tables_count INTEGER DEFAULT 0,
  total_rows INTEGER DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  
  -- معلومات GitHub
  github_path TEXT,
  github_commit_sha TEXT,
  github_commit_url TEXT,
  
  -- معلومات الخطأ
  error_message TEXT,
  error_details JSONB,
  
  -- التوقيت
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- فهارس للأداء
CREATE INDEX idx_backup_logs_status ON public.backup_logs(status);
CREATE INDEX idx_backup_logs_started_at ON public.backup_logs(started_at DESC);

-- تفعيل RLS
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- فقط super_admin و admin يستطيعون العرض
CREATE POLICY "Super admins and admins can view backup logs"
ON public.backup_logs
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- لا أحد يستطيع التعديل/الحذف من خلال RLS العامة
-- (الـ Edge Function ستستخدم Service Role التي تتجاوز RLS)

-- تريغر تحديث updated_at
CREATE TRIGGER update_backup_logs_updated_at
BEFORE UPDATE ON public.backup_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();