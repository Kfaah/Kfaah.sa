-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT 'bg-primary',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job_roles table
CREATE TABLE public.job_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  color TEXT DEFAULT 'bg-primary',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins can insert departments" ON public.departments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for job_roles
CREATE POLICY "Anyone can view job_roles" ON public.job_roles FOR SELECT USING (true);
CREATE POLICY "Admins can insert job_roles" ON public.job_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update job_roles" ON public.job_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete job_roles" ON public.job_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Insert default departments
INSERT INTO public.departments (name, color) VALUES 
  ('التسويق الإلكتروني', 'bg-accent'),
  ('خدمة العملاء', 'bg-emerald-500'),
  ('الإدارة', 'bg-violet-500');

-- Insert default job_roles
INSERT INTO public.job_roles (name, color) VALUES 
  ('مسؤول السلات المتروكة', 'bg-rose-500'),
  ('مسؤول الحملات وكبار الداعمين', 'bg-emerald-500'),
  ('مسؤول الاستقطاع الدوري', 'bg-accent'),
  ('مسؤول تطوير المتجر', 'bg-violet-500'),
  ('المشرف العام', 'bg-primary');