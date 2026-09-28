# Kfaah full recovery audit — 2026-09-28

## User objective
Restore the Kfaah platform after migration from Lovable + hosted Supabase to Hetzner so the migrated platform is functionally complete, not merely visually available.

## Required scope
- Validate and restore file upload/download/preview flows and every referenced storage bucket.
- Validate all frontend calls to Supabase Edge Functions against the available backend functions.
- Validate AI analysis, plan generation, executive plan generation, intelligence, reports, task AI, marketing AI, and related pipelines.
- Validate organization isolation, organization branding, logos, colors, icons, and active-organization scoping.
- Validate migrated records for the Tadabbur organization: analyses, employees, plans, tasks, uploads, and related data.
- Validate authentication, REST, storage, realtime, and function gateway routing.
- Detect missing migrations, missing storage policies, missing runtime secrets, missing server routes, or legacy cloud dependencies.
- Preserve Hetzner production targeting. Do not reintroduce Lovable or hosted *.supabase.co dependencies.
- Diagnose first using read-only runtime checks. Apply source fixes only after a failure is demonstrated.
- Do not promote to live until the repaired build and runtime dependencies have been verified.

## Acceptance criteria
A feature is not considered restored merely because its page renders. Its create/read/update/upload/download/AI operation must complete successfully against the Hetzner stack, with correct organization scope and recoverable failure handling.
