import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";

export interface AutomationCapabilities {
  source: "rules-v1";
  mode: "rules" | "legacy_ai";
  preview_only: true;
  supported: string[];
  writes_enabled: false;
  evaluation_policy: string;
}

// All callers use the configured first-party service and the current authenticated session.
// No provider URL, service-role credential or persistent mutation is used here.
export async function requestAutomationPreview<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.functions.invoke("automation-preview", {
    body,
    signal,
    timeout: 90_000,
  });
  if (error) {
    let message = "تعذر إكمال المعاينة. تحقق من الاتصال وصلاحياتك ثم أعد المحاولة.";
    const response = error.context;
    if (response instanceof Response) {
      try {
        const details = await response.clone().json();
        if (typeof details?.message === "string") message = details.message;
      } catch { /* Keep a useful error when the response is not JSON. */ }
    }
    throw new Error(message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("استجابة المعاينة غير صالحة. لم تُعرض نتيجة غير مؤكدة.");
  }
  if (data.error) throw new Error(typeof data.message === "string" ? data.message : "تعذرت المعاينة.");
  return data as T;
}

// Shared query deduplicates requests between the dashboard notice and the preview page.
// User and organization are both cache keys; a previous tenant's mode is never a placeholder.
export function useAutomationCapabilities() {
  const { user } = useAuth();
  const { currentOrg, loading } = useOrganization();
  return useQuery({
    queryKey: ["automation-capabilities", user?.id, currentOrg?.id],
    enabled: Boolean(user?.id && currentOrg?.id && !loading),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const result = await requestAutomationPreview<AutomationCapabilities>({
        operation: "capabilities", organization_id: currentOrg!.id,
      }, signal);
      if (result.source !== "rules-v1" || !["rules", "legacy_ai"].includes(result.mode) ||
          result.preview_only !== true || result.writes_enabled !== false || !Array.isArray(result.supported) ||
          !result.supported.every(capability => typeof capability === "string") || typeof result.evaluation_policy !== "string") {
        throw new Error("تعذر تأكيد وضع التشغيل من الخادم.");
      }
      return result;
    },
  });
}

export function AutomationModeNotice() {
  const { currentOrg } = useOrganization();
  const capabilities = useAutomationCapabilities();
  if (!currentOrg) return null;
  const mode = capabilities.isError ? undefined : capabilities.data?.mode;
  const previewPath = currentOrg.slug ? `/${encodeURIComponent(currentOrg.slug)}/automation-preview` : "/automation-preview";
  return (
    <section dir="rtl" aria-label="وضع المعالجة الآلية" className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
      {capabilities.isPending ? <Loader2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" /> : mode ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">
          {mode === "rules" ? "وضع القواعد الآلية مفعّل" : mode === "legacy_ai" ? "الوضع التقليدي مفعّل؛ معاينة القواعد متاحة" : capabilities.isPending ? "جارٍ التحقق من وضع التشغيل…" : "وضع التشغيل غير مؤكد"}
        </p>
        <p className="text-xs leading-6 text-muted-foreground">
          {mode === "rules" ? "المعالجة المدعومة تعمل دون مزوّد ذكاء اصطناعي خارجي. " : mode === "legacy_ai" ? "لم يُفعّل إيقاف المزوّد الخارجي في المسارات التقليدية. " : "لم نتمكن بعد من تأكيد إعداد الخادم. "}
          معاينة القواعد للقراءة فقط: لا تنشئ مهاماً أو إشعارات ولا تغيّر درجات الموظفين. مخرجات الذكاء الاصطناعي السابقة محفوظة كسجل تاريخي.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {capabilities.isError && <Button size="sm" variant="ghost" disabled={capabilities.isFetching} onClick={() => capabilities.refetch()}>إعادة التحقق</Button>}
        <Button asChild size="sm" variant="outline"><Link to={previewPath}>معاينة القواعد <ArrowLeft className="mr-2 h-4 w-4" /></Link></Button>
      </div>
    </section>
  );
}
