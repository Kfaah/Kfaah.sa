ALTER TABLE public.org_external_sources DROP CONSTRAINT IF EXISTS org_external_sources_kind_check;
ALTER TABLE public.org_external_sources ADD CONSTRAINT org_external_sources_kind_check
CHECK (kind = ANY (ARRAY['website','store','twitter','instagram','facebook','linkedin','youtube','tiktok','snapchat']));

-- Backfill any profile channel URL that has no source row yet
INSERT INTO public.org_external_sources (organization_id, kind, url, label)
SELECT p.organization_id, v.kind, trim(v.url), v.label
FROM public.organization_profiles p
CROSS JOIN LATERAL (VALUES
  ('website', p.website_url, 'الموقع الإلكتروني'),
  ('store', p.store_url, 'المتجر / صفحة التبرع'),
  ('twitter', p.twitter_url, 'تويتر / X'),
  ('instagram', p.instagram_url, 'إنستغرام'),
  ('tiktok', p.tiktok_url, 'تيك توك'),
  ('snapchat', p.snapchat_url, 'سناب شات'),
  ('youtube', p.youtube_url, 'يوتيوب'),
  ('facebook', p.facebook_url, 'فيسبوك'),
  ('linkedin', p.linkedin_url, 'لينكدإن')
) AS v(kind, url, label)
WHERE v.url IS NOT NULL AND trim(v.url) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.org_external_sources s
    WHERE s.organization_id = p.organization_id
      AND s.kind = v.kind
      AND s.url = trim(v.url)
  );