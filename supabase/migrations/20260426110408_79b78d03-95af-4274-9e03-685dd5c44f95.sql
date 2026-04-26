-- Allow public (anonymous) read of organization branding fields only.
-- This is required so the pre-React script in index.html can fetch
-- branding colors/logo by slug without authentication, eliminating
-- the flash-of-default-theme on first paint.
--
-- organization_profiles contains branding (colors, logo) plus other
-- org descriptive data. Branding is intentionally public — it's
-- visible on every page anyway. So we expose the whole row to anon
-- reads, matching the pattern already used by public.organizations.
CREATE POLICY "Public can read organization profiles for branding"
ON public.organization_profiles
FOR SELECT
TO anon, authenticated
USING (true);