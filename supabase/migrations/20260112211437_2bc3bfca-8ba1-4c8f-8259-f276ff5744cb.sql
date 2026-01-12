-- Allow direct managers to view requests assigned to them
CREATE POLICY "Managers can view assigned requests" 
ON public.hr_requests 
FOR SELECT 
USING (auth.uid() = direct_manager_id);

-- Allow substitute employees to view requests where they are assigned
CREATE POLICY "Substitutes can view assigned requests" 
ON public.hr_requests 
FOR SELECT 
USING (auth.uid() = substitute_employee_id);

-- Allow managers to update requests assigned to them (for approval/rejection)
CREATE POLICY "Managers can update assigned requests" 
ON public.hr_requests 
FOR UPDATE 
USING (auth.uid() = direct_manager_id);