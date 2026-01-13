-- Create table to store order of all columns (standard + custom)
CREATE TABLE public.operational_plan_column_order (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_key TEXT NOT NULL UNIQUE, -- 'strategic_goal', 'initiative', 'activity', 'responsible_employee', 'annual_target', 'monthly_average', or custom column UUID
  column_name TEXT NOT NULL, -- Display name
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_standard BOOLEAN NOT NULL DEFAULT false, -- true for built-in columns
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operational_plan_column_order ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage column order"
  ON public.operational_plan_column_order
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view column order"
  ON public.operational_plan_column_order
  FOR SELECT
  USING (true);

-- Insert default standard columns
INSERT INTO public.operational_plan_column_order (column_key, column_name, display_order, is_visible, is_standard) VALUES
  ('strategic_goal', 'الهدف الاستراتيجي', 0, true, true),
  ('initiative', 'المبادرة', 1, true, true),
  ('activity', 'النشاط', 2, true, true),
  ('responsible_employee', 'مسؤول التنفيذ', 3, true, true),
  ('annual_target', 'المستهدف السنوي', 4, true, true),
  ('monthly_average', 'المتوسط الشهري', 5, true, true);

-- Trigger for updated_at
CREATE TRIGGER update_column_order_updated_at
  BEFORE UPDATE ON public.operational_plan_column_order
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();