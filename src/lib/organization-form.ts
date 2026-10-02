// Keep these names aligned with App.tsx and the organization URL database guard.
export const RESERVED_ORGANIZATION_SLUGS = new Set([
  "admin", "app", "employees", "roles", "tasks", "plans", "executive-plans",
  "operational-plans", "profile", "settings", "uploads", "intelligence",
  "internal-dashboard", "my-accountability", "my-performance", "employee-onboarding",
  "staff-duties-upload", "my-assistant", "performance", "organizations",
  "messages", "inbox", "platform-mail", "internal-inbox", "auth", "j", "demo",
  "features", "subscribe", "about", "support", "unsubscribe", "letter-invitation",
  "storage", "rest", "functions", "realtime", "api", "assets",
]);

export function validateOrganizationForm(
  form: { name: string; slug: string; contact_email: string },
  previousSlug?: string | null,
): string | null {
  if (!form.name.trim()) return "اسم الجمعية مطلوب";
  const slug = form.slug.trim().toLowerCase();
  if (!slug) return "رابط الجمعية مطلوب";
  // Existing special entries, including the demo organization, keep their URL.
  if (slug !== previousSlug) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug))
      return "الرابط يقبل حروفاً إنجليزية وأرقاماً وشرطة بين الكلمات، حتى 63 حرفاً";
    if (RESERVED_ORGANIZATION_SLUGS.has(slug)) return "هذا الرابط محجوز للمنصة؛ اختر رابطاً آخر";
  }
  const email = form.contact_email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "أدخل بريداً إلكترونياً صحيحاً";
  return null;
}

export function organizationSaveError(error: unknown): string {
  const { code, message = "" } = (error ?? {}) as { code?: string; message?: string };
  if (code === "23505") return "رابط الجمعية مستخدم بالفعل؛ اختر رابطاً آخر";
  if (message.includes("organization_slug_reserved")) return "هذا الرابط محجوز للمنصة؛ اختر رابطاً آخر";
  if (message.includes("organization_slug_invalid")) return "رابط الجمعية غير صالح";
  if (message.includes("organization_name_required")) return "اسم الجمعية مطلوب";
  if (code === "PGRST116") return "لم تُحفظ البيانات. حدّث القائمة وتحقق من صلاحيتك ثم أعد المحاولة";
  return "تعذّر حفظ الجمعية. تحقق من الاتصال ثم أعد المحاولة";
}
