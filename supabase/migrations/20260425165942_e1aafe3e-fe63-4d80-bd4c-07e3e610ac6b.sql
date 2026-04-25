CREATE TABLE public.employee_intelligence_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  employee_id UUID,
  organization_id UUID,
  
  -- المهارات والخبرات التقنية
  technical_skills JSONB DEFAULT '[]'::jsonb,
  languages JSONB DEFAULT '[]'::jsonb,
  certifications JSONB DEFAULT '[]'::jsonb,
  years_of_experience INTEGER,
  previous_roles TEXT,
  
  -- النمط الشخصي وأسلوب العمل
  work_style TEXT, -- solo / team / hybrid
  pressure_handling TEXT, -- low / medium / high
  planning_preference TEXT, -- long_term / short_term / mixed
  communication_style TEXT,
  personality_notes TEXT,
  
  -- الأهداف والتوجهات
  career_goals TEXT,
  development_areas JSONB DEFAULT '[]'::jsonb,
  preferred_domains JSONB DEFAULT '[]'::jsonb,
  
  -- التوفر والقدرة الاستيعابية
  focus_hours_per_day INTEGER DEFAULT 6,
  max_parallel_tasks INTEGER DEFAULT 5,
  peak_hours TEXT, -- morning / afternoon / evening
  unavailable_days JSONB DEFAULT '[]'::jsonb,
  
  -- ميتاداتا
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed_at TIMESTAMP WITH TIME ZONE,
  ai_summary TEXT,
  ai_analyzed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_intelligence_profiles ENABLE ROW LEVEL SECURITY;

-- الموظف يصل لملفه الخاص
CREATE POLICY "Users can view own intelligence profile"
ON public.employee_intelligence_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intelligence profile"
ON public.employee_intelligence_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intelligence profile"
ON public.employee_intelligence_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- المدير ومدير النظام
CREATE POLICY "Admins view org intelligence profiles"
ON public.employee_intelligence_profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Super admin all intelligence profiles"
ON public.employee_intelligence_profiles FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_employee_intelligence_profiles_updated_at
BEFORE UPDATE ON public.employee_intelligence_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();