
-- جدول الرؤى الذكية
CREATE TABLE public.donor_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- 'donor_pattern', 'campaign_performance', 'segment_analysis', 'retention_risk', 'opportunity', 'trend'
  category TEXT NOT NULL, -- 'donors', 'campaigns', 'projects', 'gifts', 'subscriptions', 'general'
  severity TEXT NOT NULL DEFAULT 'info', -- 'critical', 'high', 'medium', 'low', 'info'
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB,
  affected_entities JSONB, -- {"donors": [...], "campaigns": [...]}
  metrics JSONB, -- numeric KPIs
  recommended_actions JSONB, -- array of action suggestions
  ai_model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insights_org ON public.donor_insights(organization_id, is_active, generated_at DESC);
CREATE INDEX idx_insights_type ON public.donor_insights(insight_type, severity);

ALTER TABLE public.donor_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view insights" ON public.donor_insights FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org admin manage insights" ON public.donor_insights FOR ALL USING (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Super admin all insights" ON public.donor_insights FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- جدول المهام الذكية
CREATE TABLE public.smart_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL, -- 'thank_you', 'anniversary', 'recovery', 'follow_up', 'project_report', 'sponsorship_end', 'reactivation', 'milestone'
  category TEXT NOT NULL, -- 'crm', 'marketing', 'recovery', 'reporting'
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  context JSONB, -- {"donor_id": "...", "donation_id": "...", "campaign_id": "...", "amount": ...}
  suggested_message TEXT, -- AI-generated outreach message
  suggested_channel TEXT, -- 'whatsapp', 'sms', 'email', 'call'
  related_donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  related_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  assigned_to UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'done', 'dismissed'
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  outcome_notes TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  ai_model TEXT,
  source_insight_id UUID REFERENCES public.donor_insights(id) ON DELETE SET NULL,
  source_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_smart_tasks_org_status ON public.smart_tasks(organization_id, status, due_date);
CREATE INDEX idx_smart_tasks_assigned ON public.smart_tasks(assigned_to, status);
CREATE INDEX idx_smart_tasks_donor ON public.smart_tasks(related_donor_id);

ALTER TABLE public.smart_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view smart tasks" ON public.smart_tasks FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Assigned users update smart tasks" ON public.smart_tasks FOR UPDATE USING (assigned_to = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Org admin manage smart tasks" ON public.smart_tasks FOR ALL USING (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Super admin all smart tasks" ON public.smart_tasks FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- جدول الأفكار التسويقية
CREATE TABLE public.marketing_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  idea_type TEXT NOT NULL, -- 'campaign', 'social_post', 'donor_segment', 'storytelling', 'seasonal', 'content_series'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_segment TEXT,
  channels JSONB, -- ['instagram', 'twitter', 'whatsapp', 'email']
  expected_impact TEXT,
  effort_level TEXT, -- 'low', 'medium', 'high'
  content_draft TEXT,
  hashtags JSONB,
  visuals_suggestion TEXT,
  data_basis JSONB, -- which insights/data triggered this idea
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'approved', 'in_progress', 'launched', 'archived'
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_marketing_ideas_org ON public.marketing_ideas(organization_id, status, created_at DESC);

ALTER TABLE public.marketing_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view marketing" ON public.marketing_ideas FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org admin manage marketing" ON public.marketing_ideas FOR ALL USING (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Super admin all marketing" ON public.marketing_ideas FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- جدول أحداث دورة حياة المتبرع
CREATE TABLE public.donor_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES public.donors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'first_donation', 'milestone_amount', 'donation_anniversary', 'returning', 'lapsing', 'churned', 'segment_upgrade', 'gift_given', 'gift_received', 'subscription_started', 'subscription_cancelled', 'sponsorship_ended'
  event_date DATE NOT NULL,
  amount NUMERIC,
  metadata JSONB,
  task_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lifecycle_donor ON public.donor_lifecycle_events(donor_id, event_date DESC);
CREATE INDEX idx_lifecycle_org_date ON public.donor_lifecycle_events(organization_id, event_date DESC);
CREATE INDEX idx_lifecycle_unprocessed ON public.donor_lifecycle_events(organization_id, task_generated) WHERE task_generated = false;

ALTER TABLE public.donor_lifecycle_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view lifecycle" ON public.donor_lifecycle_events FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org admin manage lifecycle" ON public.donor_lifecycle_events FOR ALL USING (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Super admin all lifecycle" ON public.donor_lifecycle_events FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- جدول تشغيلات التحليل
CREATE TABLE public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_by UUID,
  trigger_source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'upload', 'scheduled'
  upload_id UUID,
  scope JSONB, -- which datasets analyzed
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  insights_generated INTEGER NOT NULL DEFAULT 0,
  tasks_generated INTEGER NOT NULL DEFAULT 0,
  ideas_generated INTEGER NOT NULL DEFAULT 0,
  events_detected INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_analysis_runs_org ON public.analysis_runs(organization_id, started_at DESC);

ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members view runs" ON public.analysis_runs FOR SELECT USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org admin manage runs" ON public.analysis_runs FOR ALL USING (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid())) WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Super admin all runs" ON public.analysis_runs FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- triggers لتحديث updated_at
CREATE TRIGGER trg_donor_insights_updated BEFORE UPDATE ON public.donor_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_smart_tasks_updated BEFORE UPDATE ON public.smart_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketing_ideas_updated BEFORE UPDATE ON public.marketing_ideas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- triggers لتعبئة organization_id تلقائياً
CREATE TRIGGER trg_set_org_insights BEFORE INSERT ON public.donor_insights FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER trg_set_org_smart_tasks BEFORE INSERT ON public.smart_tasks FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER trg_set_org_marketing BEFORE INSERT ON public.marketing_ideas FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER trg_set_org_lifecycle BEFORE INSERT ON public.donor_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
CREATE TRIGGER trg_set_org_runs BEFORE INSERT ON public.analysis_runs FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_on_insert();
