-- ============================================
-- 1. Employee Assistant Conversations
-- ============================================
CREATE TABLE public.employee_assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  title text NOT NULL DEFAULT 'محادثة جديدة',
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_conv_user ON public.employee_assistant_conversations(user_id, last_message_at DESC);

ALTER TABLE public.employee_assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own conversations"
  ON public.employee_assistant_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins view org conversations"
  ON public.employee_assistant_conversations FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Super admin all conversations"
  ON public.employee_assistant_conversations FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_assistant_conversations_updated_at
  BEFORE UPDATE ON public.employee_assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. Assistant Messages
-- ============================================
CREATE TABLE public.employee_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.employee_assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_msg_conv ON public.employee_assistant_messages(conversation_id, created_at);

ALTER TABLE public.employee_assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own messages"
  ON public.employee_assistant_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org admins view org messages"
  ON public.employee_assistant_messages FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.employee_assistant_conversations c
      WHERE c.id = conversation_id
        AND c.organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Super admin all messages"
  ON public.employee_assistant_messages FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- ============================================
-- 3. Task Quality Evaluations (AI scores per completed task)
-- ============================================
CREATE TABLE public.task_quality_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  organization_id uuid,
  quality_score numeric NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
  strengths jsonb DEFAULT '[]'::jsonb,
  improvements jsonb DEFAULT '[]'::jsonb,
  summary text,
  ai_model text,
  evaluated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_quality_user_date ON public.task_quality_evaluations(user_id, evaluated_at DESC);
CREATE INDEX idx_task_quality_org ON public.task_quality_evaluations(organization_id, evaluated_at DESC);

ALTER TABLE public.task_quality_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quality"
  ON public.task_quality_evaluations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Org admins view org quality"
  ON public.task_quality_evaluations FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Super admin all quality"
  ON public.task_quality_evaluations FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Service role insert quality"
  ON public.task_quality_evaluations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role update quality"
  ON public.task_quality_evaluations FOR UPDATE
  USING (true);

-- ============================================
-- 4. Employee AI Usage Logs
-- ============================================
CREATE TABLE public.employee_ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  feature text NOT NULL,
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_date ON public.employee_ai_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_org_date ON public.employee_ai_usage_logs(organization_id, created_at DESC);

ALTER TABLE public.employee_ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own usage"
  ON public.employee_ai_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own usage"
  ON public.employee_ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Org admins view org usage"
  ON public.employee_ai_usage_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Super admin all usage"
  ON public.employee_ai_usage_logs FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));