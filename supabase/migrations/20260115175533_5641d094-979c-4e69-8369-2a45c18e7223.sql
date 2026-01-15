-- جدول أقسام الملفات المخصصة لكل مستخدم
CREATE TABLE public.file_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text DEFAULT 'File',
  display_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- تفعيل RLS
ALTER TABLE public.file_categories ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول - كل مستخدم يتحكم بأقسامه فقط
CREATE POLICY "Users can view own categories"
  ON public.file_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
  ON public.file_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.file_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.file_categories FOR DELETE
  USING (auth.uid() = user_id);

-- تحديث تلقائي لـ updated_at
CREATE TRIGGER update_file_categories_updated_at
  BEFORE UPDATE ON public.file_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();