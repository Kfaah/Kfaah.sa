-- جدول تسجيل الحضور اليومي
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  check_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out_at TIMESTAMP WITH TIME ZONE NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- تفعيل RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للحضور
CREATE POLICY "Users can view own attendance"
ON public.attendance FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
ON public.attendance FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
ON public.attendance FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance"
ON public.attendance FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all attendance"
ON public.attendance FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- جدول المهمة النشطة الحالية
CREATE TABLE public.active_task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.active_task ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان للمهمة النشطة
CREATE POLICY "Users can view own active task"
ON public.active_task FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own active task"
ON public.active_task FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active task"
ON public.active_task FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own active task"
ON public.active_task FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all active tasks"
ON public.active_task FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- دالة للتحقق من صلاحية تعديل الوقت
CREATE OR REPLACE FUNCTION public.can_edit_time(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR role = 'time_editor')
  )
$$;