-- جدول الخطط التشغيلية
CREATE TABLE public.operational_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    activity_name TEXT NOT NULL,
    annual_target INTEGER NOT NULL DEFAULT 0,
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول توزيع المستهدف الشهري
CREATE TABLE public.operational_plan_months (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    operational_plan_id UUID NOT NULL REFERENCES public.operational_plans(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    monthly_target INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(operational_plan_id, month)
);

-- جدول الخطط التنفيذية (توزيع على الأيام)
CREATE TABLE public.executive_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    operational_plan_month_id UUID NOT NULL REFERENCES public.operational_plan_months(id) ON DELETE CASCADE,
    day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
    daily_target INTEGER NOT NULL DEFAULT 0,
    achieved INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(operational_plan_month_id, day)
);

-- تفعيل RLS
ALTER TABLE public.operational_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_plan_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_plans ENABLE ROW LEVEL SECURITY;

-- سياسات الخطط التشغيلية
CREATE POLICY "Admins can view all operational plans"
ON public.operational_plans FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view own operational plans"
ON public.operational_plans FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert operational plans"
ON public.operational_plans FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can insert own operational plans"
ON public.operational_plans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update operational plans"
ON public.operational_plans FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can update own operational plans"
ON public.operational_plans FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete operational plans"
ON public.operational_plans FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- سياسات توزيع الأشهر
CREATE POLICY "Users can view operational plan months"
ON public.operational_plan_months FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.operational_plans op 
        WHERE op.id = operational_plan_id 
        AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Users can insert operational plan months"
ON public.operational_plan_months FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.operational_plans op 
        WHERE op.id = operational_plan_id 
        AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Users can update operational plan months"
ON public.operational_plan_months FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.operational_plans op 
        WHERE op.id = operational_plan_id 
        AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Admins can delete operational plan months"
ON public.operational_plan_months FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.operational_plans op 
        WHERE op.id = operational_plan_id 
        AND has_role(auth.uid(), 'admin'::app_role)
    )
);

-- سياسات الخطط التنفيذية
CREATE POLICY "Users can view executive plans"
ON public.executive_plans FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.operational_plan_months opm
        JOIN public.operational_plans op ON op.id = opm.operational_plan_id
        WHERE opm.id = operational_plan_month_id 
        AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Users can insert executive plans"
ON public.executive_plans FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.operational_plan_months opm
        JOIN public.operational_plans op ON op.id = opm.operational_plan_id
        WHERE opm.id = operational_plan_month_id 
        AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Users can update executive plans"
ON public.executive_plans FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.operational_plan_months opm
        JOIN public.operational_plans op ON op.id = opm.operational_plan_id
        WHERE opm.id = operational_plan_month_id 
        AND (op.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
);

CREATE POLICY "Admins can delete executive plans"
ON public.executive_plans FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.operational_plan_months opm
        JOIN public.operational_plans op ON op.id = opm.operational_plan_id
        WHERE opm.id = operational_plan_month_id 
        AND has_role(auth.uid(), 'admin'::app_role)
    )
);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_operational_plans_updated_at
BEFORE UPDATE ON public.operational_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_executive_plans_updated_at
BEFORE UPDATE ON public.executive_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();