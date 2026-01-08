export function getArabicErrorMessage(
  error: unknown,
  fallback = "حدث خطأ غير متوقع"
): string {
  const msg =
    typeof error === "string"
      ? error
      : (error as any)?.message || (error as any)?.error_description || "";

  const trimmed = String(msg || "").trim();
  if (!trimmed) return fallback;

  // functions.invoke errors often look like:
  // "Edge function returned 400: Error, {\"error\":\"...\"}"
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    const jsonPart = trimmed.slice(jsonStart);
    try {
      const parsed = JSON.parse(jsonPart);
      if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // ignore JSON parse failures
    }
  }

  // If message already contains Arabic, keep it.
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  // Common auth / network / permission errors
  if (trimmed.includes("Invalid login credentials")) return "بيانات الدخول غير صحيحة";
  if (trimmed.includes("User already registered") || trimmed.includes("already been registered"))
    return "الحساب مسجل مسبقاً";
  if (trimmed.includes("Email not confirmed")) return "الحساب غير مُفعّل بعد";

  const lower = trimmed.toLowerCase();
  if (lower.includes("password") && (lower.includes("least") || lower.includes("weak")))
    return "كلمة المرور غير صالحة";

  if (trimmed.includes("JWT expired") || lower.includes("expired"))
    return "انتهت الجلسة، الرجاء تسجيل الدخول مرة أخرى";
  if (trimmed.includes("Not authenticated") || trimmed.includes("Auth session missing"))
    return "يرجى تسجيل الدخول أولاً";
  if (lower.includes("row level security")) return "ليس لديك صلاحية لتنفيذ هذه العملية";
  if (trimmed.includes("Failed to fetch") || trimmed.includes("NetworkError"))
    return "تعذر الاتصال بالخادم، حاول مرة أخرى";
  if (lower.includes("duplicate key value") || lower.includes("already exists"))
    return "البيانات مسجلة مسبقاً";

  // Otherwise: don't expose raw English technical details
  return fallback;
}
