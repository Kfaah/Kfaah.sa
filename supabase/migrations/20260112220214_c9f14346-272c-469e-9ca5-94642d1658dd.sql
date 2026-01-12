-- Add policy for substitutes to update their assigned requests (for approval)
CREATE POLICY "Substitutes can update assigned requests" 
ON public.hr_requests 
FOR UPDATE 
USING (auth.uid() = substitute_employee_id);