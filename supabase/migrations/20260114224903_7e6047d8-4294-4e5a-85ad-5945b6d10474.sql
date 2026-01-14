-- إنشاء جدول ملفات الموظفين
CREATE TABLE public.employee_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تمكين أمان مستوى الصف
ALTER TABLE public.employee_files ENABLE ROW LEVEL SECURITY;

-- سياسة: المستخدم يمكنه عرض ملفاته فقط
CREATE POLICY "Users can view their own files" 
ON public.employee_files 
FOR SELECT 
USING (auth.uid() = user_id);

-- سياسة: المستخدم يمكنه إضافة ملفاته فقط
CREATE POLICY "Users can insert their own files" 
ON public.employee_files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- سياسة: المستخدم يمكنه حذف ملفاته فقط
CREATE POLICY "Users can delete their own files" 
ON public.employee_files 
FOR DELETE 
USING (auth.uid() = user_id);

-- سياسة: المدير يمكنه عرض جميع الملفات
CREATE POLICY "Admins can view all files" 
ON public.employee_files 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- إنشاء bucket للملفات
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-files', 'employee-files', true)
ON CONFLICT (id) DO NOTHING;

-- سياسات التخزين
CREATE POLICY "Users can upload their own files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'employee-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files in storage" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'employee-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files from storage" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'employee-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- المدير يمكنه عرض جميع الملفات
CREATE POLICY "Admins can view all files in storage" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'employee-files' AND public.has_role(auth.uid(), 'admin'));