
-- Marketing campaigns
CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  goal text,
  status text NOT NULL DEFAULT 'draft', -- draft|planned|active|paused|completed|archived
  audience_segment text,
  audience_filters jsonb DEFAULT '{}'::jsonb,
  primary_message text,
  content_angles jsonb DEFAULT '[]'::jsonb,
  platforms jsonb DEFAULT '[]'::jsonb, -- ["whatsapp","sms","x","instagram"...]
  budget_planned numeric DEFAULT 0,
  budget_actual numeric DEFAULT 0,
  start_date date,
  end_date date,
  season_key text,
  related_project text,
  expected_kpis jsonb DEFAULT '{}'::jsonb,
  ai_generated boolean DEFAULT false,
  ai_metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcampaigns_org ON public.marketing_campaigns(organization_id);
CREATE INDEX idx_mcampaigns_status ON public.marketing_campaigns(status);

-- Assets
CREATE TABLE public.marketing_campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  asset_type text NOT NULL, -- text|design_brief|design|video_script|video|motion|image
  title text,
  body text,
  file_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_massets_campaign ON public.marketing_campaign_assets(campaign_id);

-- Channels
CREATE TABLE public.marketing_campaign_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  channel text NOT NULL, -- whatsapp|sms|email|x|instagram|snapchat|tiktok|youtube|google_ads|meta_ads
  scheduled_at timestamptz,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'planned', -- planned|scheduled|published|failed
  message text,
  assigned_to uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mchannels_campaign ON public.marketing_campaign_channels(campaign_id);

-- Metrics (time-series)
CREATE TABLE public.marketing_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  channel text,
  measured_at timestamptz NOT NULL DEFAULT now(),
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  donations_count integer DEFAULT 0,
  donations_amount numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  notes text
);
CREATE INDEX idx_mmetrics_campaign ON public.marketing_campaign_metrics(campaign_id);

-- Seasonal calendar (shared)
CREATE TABLE public.marketing_seasonal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  description text,
  category text, -- religious|national|seasonal|awareness
  hijri_month integer,
  hijri_day integer,
  gregorian_month integer,
  gregorian_day integer,
  duration_days integer DEFAULT 1,
  marketing_tips jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Playbook memory
CREATE TABLE public.marketing_playbook_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  insight_type text NOT NULL, -- success|failure|best_time|best_channel|message_pattern
  audience_segment text,
  channel text,
  finding text NOT NULL,
  evidence jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mplaybook_org ON public.marketing_playbook_memory(organization_id);

-- updated_at trigger
CREATE TRIGGER trg_mcampaigns_updated_at
  BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_seasonal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_playbook_memory ENABLE ROW LEVEL SECURITY;

-- Helper macro: org members can view; org admins can write
CREATE POLICY "campaigns_select" ON public.marketing_campaigns FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "campaigns_insert" ON public.marketing_campaigns FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "campaigns_update" ON public.marketing_campaigns FOR UPDATE
  USING (public.is_org_admin(auth.uid(), organization_id));
CREATE POLICY "campaigns_delete" ON public.marketing_campaigns FOR DELETE
  USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "assets_select" ON public.marketing_campaign_assets FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "assets_write" ON public.marketing_campaign_assets FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "channels_select" ON public.marketing_campaign_channels FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "channels_write" ON public.marketing_campaign_channels FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "metrics_select" ON public.marketing_campaign_metrics FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "metrics_write" ON public.marketing_campaign_metrics FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "seasonal_select" ON public.marketing_seasonal_events FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "seasonal_super_admin_write" ON public.marketing_seasonal_events FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "playbook_select" ON public.marketing_playbook_memory FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));
CREATE POLICY "playbook_write" ON public.marketing_playbook_memory FOR ALL
  USING (public.is_org_admin(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- Seed seasonal events (Saudi religious + national + key seasons)
INSERT INTO public.marketing_seasonal_events (key, name_ar, description, category, hijri_month, hijri_day, duration_days, marketing_tips) VALUES
  ('ramadan', 'شهر رمضان المبارك', 'أفضل موسم تسويقي للجمعيات الخيرية - الزكاة والصدقات', 'religious', 9, 1, 30, '["ابدأ التحضير قبل 30 يوم","ركز على إفطار الصائم وزكاة الفطر","واتساب وX الأكثر فعالية","رسائل ليلية بعد التراويح"]'::jsonb),
  ('ten_dhul_hijjah', 'العشر من ذي الحجة', 'أفضل أيام الدنيا للعمل الصالح', 'religious', 12, 1, 10, '["حملة الأضاحي","التذكير اليومي بفضل الأيام","قصص الأثر والمستفيدين"]'::jsonb),
  ('eid_al_fitr', 'عيد الفطر المبارك', 'موسم الإهداءات والزكاة', 'religious', 10, 1, 3, '["إهداء التبرع","رسائل التهنئة مع دعوة للعطاء"]'::jsonb),
  ('eid_al_adha', 'عيد الأضحى المبارك', 'موسم الأضاحي والصدقات', 'religious', 12, 10, 4, '["مشاريع الأضاحي","توزيع لحوم الأضاحي على المستفيدين"]'::jsonb),
  ('muharram', 'شهر محرم - عاشوراء', 'فضل صيام عاشوراء وإطعام الطعام', 'religious', 1, 1, 10, '["مشاريع إطعام الطعام","قصص الأثر"]'::jsonb),
  ('rajab_shaban', 'رجب وشعبان', 'تهيئة قبل رمضان', 'religious', 7, 1, 60, '["تذكير بقرب رمضان","بناء قاعدة المتبرعين قبل الموسم"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.marketing_seasonal_events (key, name_ar, description, category, gregorian_month, gregorian_day, duration_days, marketing_tips) VALUES
  ('saudi_national_day', 'اليوم الوطني السعودي', 'فخر وعطاء', 'national', 9, 23, 1, '["حملات بهوية سعودية","قصص الأثر المحلي"]'::jsonb),
  ('saudi_founding_day', 'يوم التأسيس', 'الذكرى الوطنية', 'national', 2, 22, 1, '["محتوى تراثي","إبراز الجذور الخيرية"]'::jsonb),
  ('back_to_school', 'العودة للمدارس', 'حقيبة الطالب وكفالة الطلاب', 'seasonal', 8, 20, 30, '["مشاريع الطلاب","حقيبة المدرسة"]'::jsonb),
  ('winter_campaign', 'حملة الشتاء', 'الدفء والكسوة', 'seasonal', 11, 1, 90, '["كسوة الشتاء","سلال غذائية","قصص العائلات المحتاجة"]'::jsonb),
  ('hot_summer', 'شدة الحر', 'سقيا الماء وتبريد المساجد', 'seasonal', 6, 1, 90, '["سقيا الماء","تبريد المساجد"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
