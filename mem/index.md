# Project Memory

## Core
جميع الجمعيات لها هوية بصرية مخصصة في organization_profiles (primary_color, accent_color, secondary_color) تُطبَّق تلقائياً على كل صفحات نظام الجمعية عبر OrgBrandingContext. لا تستخدم ألواناً مكوّدة عشوائية (blue/cyan/teal/emerald/indigo/purple/pink hardcoded) — استخدم hsl(var(--primary)) و hsl(var(--accent)). الألوان المكوّدة من tailwind للعائلات المذكورة تُترجم تلقائياً عبر CSS override layer في index.css تحت html[data-org-branded="true"].
أسماء الجمعيات المختصرة (سطران) معرّفة في src/components/layout/Sidebar.tsx (ORG_SHORT_NAME_BY_KEYWORD) و src/pages/admin/OrgInternalDashboard.tsx (ORG_SHORT_NAME) — يجب أن تتطابق مع الاسم الرسمي في DB. عطف=بمحافظة العارضة، القصبة=بمركز القصبة، نجباء=بالفرشة، سكينة=بجازان.
القائمة الجانبية بدون animations مزعجة (لا spin/float/shimmer/pulse) — هادئة ورسمية وثابتة.

## Memories
- [Harf brand](mem://design/harf-brand) — Olive palette, gradient and usage example in EmployeesShowcase
- [Operational plans visual identity](mem://style/operational-plans-table-visual-identity) — Dark green table headers
- [App immersion ethos](mem://design/app-immersion-ethos) — Full-page experiences over modals
