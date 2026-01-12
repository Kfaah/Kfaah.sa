-- Add executive manager approval fields to hr_requests
ALTER TABLE public.hr_requests 
ADD COLUMN IF NOT EXISTS executive_manager_id uuid,
ADD COLUMN IF NOT EXISTS executive_manager_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS executive_manager_approved_at timestamp with time zone;

-- Add RLS policies for executive manager
CREATE POLICY "Executive managers can view assigned requests" 
ON public.hr_requests 
FOR SELECT 
USING (auth.uid() = executive_manager_id);

CREATE POLICY "Executive managers can update assigned requests" 
ON public.hr_requests 
FOR UPDATE 
USING (auth.uid() = executive_manager_id);