-- Add department_id to strategic_goals table (owner department)
ALTER TABLE public.strategic_goals 
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Add department_id to initiatives table (owner department)
ALTER TABLE public.initiatives 
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Add responsible_employee_id to operational_plans table (execution responsible)
ALTER TABLE public.operational_plans 
ADD COLUMN responsible_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Add department_id to employees table (to link employees to departments)
ALTER TABLE public.employees 
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_strategic_goals_department ON public.strategic_goals(department_id);
CREATE INDEX idx_initiatives_department ON public.initiatives(department_id);
CREATE INDEX idx_operational_plans_responsible ON public.operational_plans(responsible_employee_id);
CREATE INDEX idx_employees_department ON public.employees(department_id);