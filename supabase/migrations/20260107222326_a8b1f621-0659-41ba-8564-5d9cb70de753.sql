-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  job_role TEXT NOT NULL,
  role_color TEXT DEFAULT 'bg-primary',
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive')),
  join_date DATE DEFAULT CURRENT_DATE,
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  performance INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do everything
CREATE POLICY "Admins can view all employees"
ON public.employees
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert employees"
ON public.employees
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update employees"
ON public.employees
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete employees"
ON public.employees
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Employees can view their own record
CREATE POLICY "Employees can view own record"
ON public.employees
FOR SELECT
USING (auth.uid() = user_id);

-- Employees can update their own record (limited fields)
CREATE POLICY "Employees can update own record"
ON public.employees
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_email ON public.employees(email);
CREATE INDEX idx_employees_status ON public.employees(status);