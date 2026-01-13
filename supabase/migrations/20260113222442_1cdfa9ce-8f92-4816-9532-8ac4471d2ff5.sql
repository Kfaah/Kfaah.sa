-- إنشاء enum لأنواع الأعمدة المخصصة
CREATE TYPE public.custom_column_type AS ENUM ('text', 'number', 'date', 'department', 'employee');

-- جدول تعريف الأعمدة المخصصة للخطط التشغيلية
CREATE TABLE public.operational_plan_custom_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  column_type custom_column_type NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول قيم الأعمدة المخصصة لكل خطة تشغيلية
CREATE TABLE public.operational_plan_custom_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operational_plan_id UUID NOT NULL REFERENCES public.operational_plans(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.operational_plan_custom_columns(id) ON DELETE CASCADE,
  text_value TEXT,
  number_value NUMERIC,
  date_value DATE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(operational_plan_id, column_id)
);

-- تفعيل RLS
ALTER TABLE public.operational_plan_custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_plan_custom_values ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لجدول الأعمدة المخصصة
CREATE POLICY "Admins can manage custom columns"
  ON public.operational_plan_custom_columns
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view custom columns"
  ON public.operational_plan_custom_columns
  FOR SELECT
  USING (true);

-- سياسات الأمان لجدول القيم المخصصة
CREATE POLICY "Admins can manage custom values"
  ON public.operational_plan_custom_values
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view custom values for accessible plans"
  ON public.operational_plan_custom_values
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.operational_plans op
      WHERE op.id = operational_plan_custom_values.operational_plan_id
      AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update custom values for own plans"
  ON public.operational_plan_custom_values
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.operational_plans op
      WHERE op.id = operational_plan_custom_values.operational_plan_id
      AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert custom values for own plans"
  ON public.operational_plan_custom_values
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.operational_plans op
      WHERE op.id = operational_plan_custom_values.operational_plan_id
      AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Trigger لتحديث updated_at
CREATE TRIGGER update_custom_columns_updated_at
  BEFORE UPDATE ON public.operational_plan_custom_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custom_values_updated_at
  BEFORE UPDATE ON public.operational_plan_custom_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();