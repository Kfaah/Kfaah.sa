DROP POLICY IF EXISTS "Admins can manage quotes" ON public.welcome_quotes;
DROP POLICY IF EXISTS "Admins can manage backgrounds" ON public.welcome_backgrounds;

CREATE POLICY "Admins can manage quotes"
ON public.welcome_quotes
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

CREATE POLICY "Admins can manage backgrounds"
ON public.welcome_backgrounds
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);