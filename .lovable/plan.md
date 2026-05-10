## Plan

I'll ship this in 4 parts. Confirm and I'll execute.

### 1. Restrict the "نبذة/banner" at top of pages to demo only
- Find the top-of-page intro/description block currently rendered for every user.
- Wrap it with `useIsDemo()` so it only renders when `isDemo === true`.
- For admin/org accounts: nothing shown above the page header.

### 2. Rename "المتبرعون" → "مركز التبرعات"
- Update the sidebar/nav label and the page header for the donors hub (`DonorsHub.tsx` + `Sidebar.tsx`).
- Keep route paths as-is to avoid breaking deep links.

### 3. Add upload entries for new data types
On the Uploads page (`src/pages/Uploads.tsx`), add four new upload tiles:
- استقطاعات (subscriptions)
- حملات (campaigns)
- إهداءات (gifts)
- سلال متروكة (abandoned carts)
- (Failed donations stay inside the donations file — no separate tile.)

Each tile uses the existing upload pipeline (Excel/CSV → `data-uploads` bucket → `process-upload` edge function), with a `dataset` discriminator so rows land in the right table. After upload, the records appear in their respective tabs inside مركز التبرعات.

### 4. Cross-activity "كبار المتبرعين / بيانات مشتركة" + AI insights
New tab inside مركز التبرعات: **"النخبة"** (or "بيانات مشتركة") that:
- Joins each donor across donations, subscriptions, campaigns (as launcher), gifts (as giver), abandoned carts — keyed by `donor_id` / phone / normalized name.
- Computes an **activity score** = number of distinct activity types the person participates in.
- Shows only donors with **2+ activity types** (single-activity excluded as requested).
- Tier badges: ماسي (5 أنشطة), ذهبي (4), فضي (3), برونزي (2).
- Filters: tier, activity types, project, date range, search.
- Per-donor expandable row with timeline of all their activities.

Then a **"رؤى الذكاء الاصطناعي"** panel on the same tab:
- Button "توليد اقتراحات إبداعية" → calls a new edge function `donor-insights` that sends the aggregated dataset (anonymized counts + top segments, not raw PII) to Lovable AI (`google/gemini-3-flash-preview`).
- Returns structured JSON: segments, retention ideas, creative campaigns, content drafts (thank-you message, exclusive offer, story angle), suggested follow-up actions per tier.
- Renders as cards with copy-to-clipboard + "حفظ كملاحظة" actions.

### Technical details
- Files: `Uploads.tsx`, `Sidebar.tsx`, `DonorsHub.tsx`, new `EliteDonorsPanel` component, new `supabase/functions/donor-insights/index.ts`.
- Demo banner gating: locate the component (likely `PageHeader` or a wrapper) and wrap its intro/description in `{isDemo && (...)}`.
- AI call routed through Lovable AI Gateway with structured output via tool calling. Handles 429/402 with toasts.
- No schema changes needed unless you want to persist AI suggestions — say the word and I'll add a `donor_insights` table.

Confirm and I'll build it.