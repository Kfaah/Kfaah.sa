---
name: Harf brand identity
description: Harf Association (جمعية حرف) brand colors — teal palette from logo
type: design
---
جمعية حرف الهوية البصرية = تركوازي بحري بدرجتين من الشعار (مستخرج من pixels).
- Primary (داكن): #057D87
- Accent (فاتح): #2BA0B5
- Soft tint: #E1F2F4

الألوان محفوظة في `organization_profiles` للجمعية ويتم تطبيقها تلقائياً على كل صفحات `/harf/*` عبر `OrgBrandingContext` الذي يحقن `--primary` و `--accent` كـ CSS variables. لا حاجة لتعريفات ثابتة جديدة في الكود — استخدم `hsl(var(--primary))` و `hsl(var(--accent))` أو tailwind tokens (`bg-primary`, `text-accent`...).

القائمة الجانبية (`Sidebar.tsx`): تم إزالة جميع الـ animations المتقطعة (spin, float, shimmer, pulse, bounce) وجعلها هادئة وثابتة.
