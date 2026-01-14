-- إضافة سياسة RLS للموظفين المسؤولين عن الخطط التشغيلية
CREATE POLICY "Responsible employees can view assigned plans" 
ON public.operational_plans 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.id = operational_plans.responsible_employee_id 
    AND e.user_id = auth.uid()
  )
);

-- إضافة سياسة RLS للموظفين المسؤولين لرؤية أشهر الخطط
CREATE POLICY "Responsible employees can view plan months" 
ON public.operational_plan_months 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.operational_plans op
    JOIN public.employees e ON e.id = op.responsible_employee_id
    WHERE op.id = operational_plan_months.operational_plan_id 
    AND e.user_id = auth.uid()
  )
);

-- إضافة سياسة RLS للموظفين المسؤولين لرؤية الخطط التنفيذية
CREATE POLICY "Responsible employees can view executive plans" 
ON public.executive_plans 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.operational_plan_months opm
    JOIN public.operational_plans op ON op.id = opm.operational_plan_id
    JOIN public.employees e ON e.id = op.responsible_employee_id
    WHERE opm.id = executive_plans.operational_plan_month_id 
    AND e.user_id = auth.uid()
  )
);

-- إضافة سياسة للموظفين المسؤولين لتحديث الخطط التنفيذية
CREATE POLICY "Responsible employees can update executive plans" 
ON public.executive_plans 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.operational_plan_months opm
    JOIN public.operational_plans op ON op.id = opm.operational_plan_id
    JOIN public.employees e ON e.id = op.responsible_employee_id
    WHERE opm.id = executive_plans.operational_plan_month_id 
    AND e.user_id = auth.uid()
  )
);

-- إضافة سياسة للموظفين المسؤولين لتحديث القيم المخصصة
CREATE POLICY "Responsible employees can view custom values" 
ON public.operational_plan_custom_values 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.operational_plans op
    JOIN public.employees e ON e.id = op.responsible_employee_id
    WHERE op.id = operational_plan_custom_values.operational_plan_id 
    AND e.user_id = auth.uid()
  )
);