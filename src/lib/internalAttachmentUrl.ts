import { supabase } from "@/integrations/supabase/client";

const BUCKET = "internal-message-attachments";
const MARKER = `/${BUCKET}/`;

/** يحوّل القيمة المخزّنة (رابط عام قديم أو مسار) إلى مسار داخل الحاوية */
export const toInternalAttachmentPath = (stored: string): string => {
  const idx = stored.indexOf(MARKER);
  const raw = idx >= 0 ? stored.slice(idx + MARKER.length) : stored;
  return decodeURIComponent(raw.split("?")[0].replace(/^\/+/, ""));
};

/** ينشئ رابطاً مؤقتاً موقّعاً لعرض المرفق (ساعة واحدة) */
export const getInternalAttachmentSignedUrl = async (stored: string): Promise<string | null> => {
  const path = toInternalAttachmentPath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

/** يوقّع مجموعة مرفقات ويعيد خريطة من القيمة المخزّنة إلى الرابط الموقّع */
export const signInternalAttachments = async (stored: string[]): Promise<Record<string, string>> => {
  const unique = Array.from(new Set(stored.filter(Boolean)));
  const entries = await Promise.all(
    unique.map(async (s) => [s, await getInternalAttachmentSignedUrl(s)] as const)
  );
  return Object.fromEntries(entries.filter(([, v]) => !!v) as [string, string][]);
};
