UPDATE public.organization_profiles
SET
  primary_color = '#057D87',
  accent_color = '#2BA0B5',
  secondary_color = '#E1F2F4'
WHERE organization_id = (SELECT id FROM public.organizations WHERE slug = 'harf');