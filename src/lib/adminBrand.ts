import { supabase } from "@/integrations/supabase/client";

export type AdminBrand = { primary: string; accent: string; sidebarFrom: string; sidebarTo: string; goldAccent: string };
export const DEFAULT_ADMIN_BRAND: AdminBrand = {
  primary: "#216879", accent: "#fbbf24", sidebarFrom: "#2f8e8c", sidebarTo: "#2f8e8c", goldAccent: "#fcd34d",
};
export const ADMIN_BRAND_EVENT = "admin-brand-updated";
export function validAdminBrand(value: unknown): value is AdminBrand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(DEFAULT_ADMIN_BRAND);
  return Object.keys(value).length === keys.length && keys.every(key => /^#[\da-f]{6}$/i.test((value as Record<string, string>)[key] || ""));
}
type PreferenceClient = { from(name: "platform_admin_preferences"): any };
const preferences = supabase as unknown as PreferenceClient;
export async function loadAdminBrand(userId: string): Promise<AdminBrand> {
  const { data, error } = await preferences.from("platform_admin_preferences").select("brand").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data && !validAdminBrand(data.brand)) throw new Error("invalid_saved_brand");
  return data?.brand ?? { ...DEFAULT_ADMIN_BRAND };
}
export async function saveAdminBrand(userId: string, brand: AdminBrand): Promise<AdminBrand> {
  if (!validAdminBrand(brand)) throw new Error("invalid_brand");
  const { data, error } = await preferences.from("platform_admin_preferences")
    .upsert({ user_id: userId, brand }, { onConflict: "user_id" }).select("brand").single();
  if (error || !validAdminBrand(data?.brand)) throw error || new Error("save_not_confirmed");
  window.dispatchEvent(new Event(ADMIN_BRAND_EVENT));
  return data.brand;
}
export function adminHexToHsl(hex: string): string {
  const [r,g,b] = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2;
  const s=d===0?0:d/(1-Math.abs(2*l-1));
  const h=d===0?0:(max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;
  return `${h.toFixed(1)} ${(s*100).toFixed(1)}% ${(l*100).toFixed(1)}%`;
}
