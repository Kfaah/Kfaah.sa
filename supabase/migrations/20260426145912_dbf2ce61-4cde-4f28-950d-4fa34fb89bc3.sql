UPDATE public.organization_profiles
SET primary_color = '#00b1c5',
    accent_color = '#8bc43f',
    secondary_color = '#00508f',
    updated_at = now()
WHERE organization_id = (SELECT id FROM public.organizations WHERE slug = 'sawab');