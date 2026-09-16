import { supabase } from "@/integrations/supabase/client";

const BUCKET = "action-plan-files";
const MARKER = `/${BUCKET}/`;

/** يحوّل الرابط المخزّن (قديم عام أو مسار) إلى مسار داخل الحاوية */
export const toActionPlanFilePath = (stored: string): string => {
  const idx = stored.indexOf(MARKER);
  const raw = idx >= 0 ? stored.slice(idx + MARKER.length) : stored;
  return decodeURIComponent(raw.split("?")[0].replace(/^\/+/, ""));
};

/** ينشئ رابطاً مؤقتاً موقّعاً لعرض/تنزيل الملف (ساعة واحدة) */
export const getActionPlanFileSignedUrl = async (stored: string): Promise<string | null> => {
  const path = toActionPlanFilePath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};
