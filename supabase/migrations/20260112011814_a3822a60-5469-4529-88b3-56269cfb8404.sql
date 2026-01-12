-- 1. جدول أنواع الطلبات
CREATE TABLE public.hr_request_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  description text,
  icon text DEFAULT 'FileText',
  color text DEFAULT 'bg-primary',
  requires_attachment boolean DEFAULT false,
  deducts_from_balance boolean DEFAULT false,
  max_days integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. جدول أرصدة الإجازات
CREATE TABLE public.hr_leave_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  request_type_id uuid NOT NULL REFERENCES public.hr_request_types(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),
  total_days integer NOT NULL DEFAULT 21,
  used_days integer NOT NULL DEFAULT 0,
  remaining_days integer GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_type_id, year)
);

-- 3. جدول الطلبات الرئيسي
CREATE TABLE public.hr_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  request_type_id uuid NOT NULL REFERENCES public.hr_request_types(id),
  request_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  start_date date,
  end_date date,
  days_count integer,
  reason text,
  notes text,
  attachment_url text,
  attachment_name text,
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. جدول سجل الاعتمادات
CREATE TABLE public.hr_request_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.hr_requests(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL,
  action text NOT NULL,
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.hr_request_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_request_approvals ENABLE ROW LEVEL SECURITY;

-- سياسات hr_request_types
CREATE POLICY "Anyone can view request types" ON public.hr_request_types FOR SELECT USING (true);
CREATE POLICY "Admins can insert request types" ON public.hr_request_types FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update request types" ON public.hr_request_types FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete request types" ON public.hr_request_types FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- سياسات hr_leave_balances
CREATE POLICY "Users can view own balance" ON public.hr_leave_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all balances" ON public.hr_leave_balances FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert balances" ON public.hr_leave_balances FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update balances" ON public.hr_leave_balances FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete balances" ON public.hr_leave_balances FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- سياسات hr_requests
CREATE POLICY "Users can view own requests" ON public.hr_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own requests" ON public.hr_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pending requests" ON public.hr_requests FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users can delete own pending requests" ON public.hr_requests FOR DELETE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins can view all requests" ON public.hr_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update requests" ON public.hr_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete requests" ON public.hr_requests FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- سياسات hr_request_approvals
CREATE POLICY "Users can view own request approvals" ON public.hr_request_approvals FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.hr_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));
CREATE POLICY "Approvers can view assigned approvals" ON public.hr_request_approvals FOR SELECT USING (approver_id = auth.uid());
CREATE POLICY "Admins can manage approvals" ON public.hr_request_approvals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- إضافة أنواع الطلبات الافتراضية
INSERT INTO public.hr_request_types (name, name_ar, description, icon, color, requires_attachment, deducts_from_balance, max_days) VALUES
('annual_leave', 'إجازة سنوية', 'إجازة مدفوعة من الرصيد السنوي', 'Calendar', 'bg-blue-500', false, true, 21),
('sick_leave', 'إجازة مرضية', 'إجازة بسبب المرض مع إرفاق تقرير طبي', 'Heart', 'bg-red-500', true, true, 30),
('emergency_leave', 'إجازة اضطرارية', 'إجازة طارئة لظروف خاصة', 'AlertTriangle', 'bg-orange-500', false, true, 5),
('permission', 'استئذان', 'خروج مبكر أو حضور متأخر لساعات محددة', 'Clock', 'bg-green-500', false, false, null),
('unpaid_leave', 'إجازة بدون راتب', 'إجازة غير مدفوعة', 'DollarSign', 'bg-gray-500', false, false, null),
('certificate', 'طلب شهادة', 'طلب شهادة خبرة أو تعريف', 'Award', 'bg-teal-500', false, false, null);

-- Triggers للتحديث التلقائي
CREATE TRIGGER update_hr_request_types_updated_at BEFORE UPDATE ON public.hr_request_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hr_leave_balances_updated_at BEFORE UPDATE ON public.hr_leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hr_requests_updated_at BEFORE UPDATE ON public.hr_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();