-- Create table for welcome backgrounds
CREATE TABLE public.welcome_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for welcome quotes
CREATE TABLE public.welcome_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote TEXT NOT NULL,
  emoji TEXT DEFAULT '✨',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.welcome_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_quotes ENABLE ROW LEVEL SECURITY;

-- RLS policies for welcome_backgrounds - everyone can view active
CREATE POLICY "Anyone can view active backgrounds" 
ON public.welcome_backgrounds 
FOR SELECT 
USING (is_active = true);

-- Admins can manage backgrounds
CREATE POLICY "Admins can manage backgrounds" 
ON public.welcome_backgrounds 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- RLS policies for welcome_quotes - everyone can view active
CREATE POLICY "Anyone can view active quotes" 
ON public.welcome_quotes 
FOR SELECT 
USING (is_active = true);

-- Admins can manage quotes
CREATE POLICY "Admins can manage quotes" 
ON public.welcome_quotes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create storage bucket for welcome backgrounds
INSERT INTO storage.buckets (id, name, public) 
VALUES ('welcome-backgrounds', 'welcome-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view welcome backgrounds" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'welcome-backgrounds');

CREATE POLICY "Admins can upload welcome backgrounds" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'welcome-backgrounds' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete welcome backgrounds" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'welcome-backgrounds' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);