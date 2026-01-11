-- Allow admins to insert attendance for any user (for preview mode)
CREATE POLICY "Admins can insert attendance for any user" 
ON public.attendance 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete attendance records
CREATE POLICY "Admins can delete attendance" 
ON public.attendance 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));