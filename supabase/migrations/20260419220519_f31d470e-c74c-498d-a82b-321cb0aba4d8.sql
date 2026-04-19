
-- ============================================================
-- 1) donors — سجل المتبرعين (CRM)
-- ============================================================
CREATE TABLE public.donors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gender TEXT,
  city TEXT,
  segment TEXT NOT NULL DEFAULT 'regular',
  total_donated NUMERIC(12,2) NOT NULL DEFAULT 0,
  donations_count INTEGER NOT NULL DEFAULT 0,
  first_donation_at TIMESTAMPTZ,
  last_donation_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone),
  UNIQUE (organization_id, external_id)
);
CREATE INDEX idx_donors_org ON public.donors(organization_id);
CREATE INDEX idx_donors_segment ON public.donors(organization_id, segment);
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_donors_updated_at BEFORE UPDATE ON public.donors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_donors_set_org BEFORE INSERT ON public.donors FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 2) projects_catalog — كتالوج المشاريع
-- ============================================================
CREATE TABLE public.projects_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  external_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_projects_org ON public.projects_catalog(organization_id);
ALTER TABLE public.projects_catalog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_projects_set_org BEFORE INSERT ON public.projects_catalog FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 3) donations — التبرعات (الجذر)
-- ============================================================
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  donation_number TEXT NOT NULL,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_phone TEXT,
  project_id UUID REFERENCES public.projects_catalog(id) ON DELETE SET NULL,
  project_name TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  source TEXT,
  donation_date TIMESTAMPTZ NOT NULL,
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, donation_number)
);
CREATE INDEX idx_donations_org ON public.donations(organization_id);
CREATE INDEX idx_donations_date ON public.donations(organization_id, donation_date DESC);
CREATE INDEX idx_donations_donor ON public.donations(donor_id);
CREATE INDEX idx_donations_project ON public.donations(project_id);
CREATE INDEX idx_donations_status ON public.donations(organization_id, status);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_donations_set_org BEFORE INSERT ON public.donations FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 4) abandoned_carts — السلال المتروكة
-- ============================================================
CREATE TABLE public.abandoned_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_phone TEXT,
  project_name TEXT,
  amount NUMERIC(12,2),
  abandoned_at TIMESTAMPTZ NOT NULL,
  follow_up_status TEXT NOT NULL DEFAULT 'pending',
  followed_up_by UUID,
  followed_up_at TIMESTAMPTZ,
  recovery_notes TEXT,
  recovered BOOLEAN NOT NULL DEFAULT false,
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);
CREATE INDEX idx_carts_org ON public.abandoned_carts(organization_id);
CREATE INDEX idx_carts_status ON public.abandoned_carts(organization_id, follow_up_status);
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_carts_set_org BEFORE INSERT ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 5) subscriptions — الاستقطاعات الشهرية
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_phone TEXT,
  amount NUMERIC(12,2) NOT NULL,
  project_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  next_charge_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  cancellation_reason TEXT,
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);
CREATE INDEX idx_subs_org ON public.subscriptions(organization_id);
CREATE INDEX idx_subs_status ON public.subscriptions(organization_id, status);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_subs_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_set_org BEFORE INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 6) campaigns — الحملات
-- ============================================================
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  goal_amount NUMERIC(12,2),
  collected_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  donations_count INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);
CREATE INDEX idx_campaigns_org ON public.campaigns(organization_id);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaigns_set_org BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 7) gifts — الإهداءات
-- ============================================================
CREATE TABLE public.gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  giver_donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  giver_name TEXT,
  giver_phone TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  occasion TEXT,
  message TEXT,
  amount NUMERIC(12,2) NOT NULL,
  project_name TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  gift_date TIMESTAMPTZ,
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, external_id)
);
CREATE INDEX idx_gifts_org ON public.gifts(organization_id);
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_gifts_updated_at BEFORE UPDATE ON public.gifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_gifts_set_org BEFORE INSERT ON public.gifts FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 8) bank_transfers — التحويلات البنكية
-- ============================================================
CREATE TABLE public.bank_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  transfer_number TEXT,
  bank_name TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  amount NUMERIC(12,2) NOT NULL,
  transfer_date TIMESTAMPTZ NOT NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  matched_donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
  notes TEXT,
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, transfer_number)
);
CREATE INDEX idx_transfers_org ON public.bank_transfers(organization_id);
CREATE INDEX idx_transfers_status ON public.bank_transfers(organization_id, reconciliation_status);
ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_transfers_updated_at BEFORE UPDATE ON public.bank_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_transfers_set_org BEFORE INSERT ON public.bank_transfers FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 9) failed_donations — التبرعات الفاشلة
-- ============================================================
CREATE TABLE public.failed_donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_phone TEXT,
  amount NUMERIC(12,2),
  project_name TEXT,
  payment_method TEXT,
  failure_reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL,
  retry_status TEXT NOT NULL DEFAULT 'pending',
  upload_id UUID,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_failed_org ON public.failed_donations(organization_id);
ALTER TABLE public.failed_donations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_failed_updated_at BEFORE UPDATE ON public.failed_donations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_failed_set_org BEFORE INSERT ON public.failed_donations FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- 10) data_uploads_log — سجل الرفع
-- ============================================================
CREATE TABLE public.data_uploads_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  detected_schema TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  error_log JSONB,
  for_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_uploads_org ON public.data_uploads_log(organization_id);
CREATE INDEX idx_uploads_date ON public.data_uploads_log(organization_id, created_at DESC);
ALTER TABLE public.data_uploads_log ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_uploads_set_org BEFORE INSERT ON public.data_uploads_log FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();

-- ============================================================
-- RLS Policies — موحّدة لكل الجداول
-- ============================================================

-- Helper: نفس النمط لكل جدول
-- 1) Super admin: كل الصلاحيات
-- 2) Org admin: كل الصلاحيات داخل جمعيته
-- 3) Org member: قراءة فقط داخل جمعيته (سيُضيق لاحقاً في 2.د)

-- donors
CREATE POLICY "Super admin all donors" ON public.donors FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage donors" ON public.donors FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view donors" ON public.donors FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- projects_catalog
CREATE POLICY "Super admin all projects" ON public.projects_catalog FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage projects" ON public.projects_catalog FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view projects" ON public.projects_catalog FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- donations
CREATE POLICY "Super admin all donations" ON public.donations FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage donations" ON public.donations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view donations" ON public.donations FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- abandoned_carts
CREATE POLICY "Super admin all carts" ON public.abandoned_carts FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage carts" ON public.abandoned_carts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view carts" ON public.abandoned_carts FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members update carts" ON public.abandoned_carts FOR UPDATE USING (organization_id = public.get_user_organization_id(auth.uid()));

-- subscriptions
CREATE POLICY "Super admin all subs" ON public.subscriptions FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage subs" ON public.subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view subs" ON public.subscriptions FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- campaigns
CREATE POLICY "Super admin all campaigns" ON public.campaigns FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage campaigns" ON public.campaigns FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view campaigns" ON public.campaigns FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- gifts
CREATE POLICY "Super admin all gifts" ON public.gifts FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage gifts" ON public.gifts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view gifts" ON public.gifts FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- bank_transfers
CREATE POLICY "Super admin all transfers" ON public.bank_transfers FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage transfers" ON public.bank_transfers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view transfers" ON public.bank_transfers FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- failed_donations
CREATE POLICY "Super admin all failed" ON public.failed_donations FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage failed" ON public.failed_donations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view failed" ON public.failed_donations FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));

-- data_uploads_log
CREATE POLICY "Super admin all uploads" ON public.data_uploads_log FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Org admin manage uploads" ON public.data_uploads_log FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members view uploads" ON public.data_uploads_log FOR SELECT USING (organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Authenticated users can create uploads" ON public.data_uploads_log FOR INSERT WITH CHECK (auth.uid() = uploaded_by AND organization_id = public.get_user_organization_id(auth.uid()));
