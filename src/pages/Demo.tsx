import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * /demo — entry point for the public demo organization.
 * Runs the setup-demo edge function (idempotent), signs the visitor in
 * with the read-only demo viewer account, then redirects to the demo
 * organization's dashboard.
 */
export default function Demo() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"booting" | "signing_in" | "ready" | "error">("booting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Make sure the demo user exists & data is seeded
        setStatus("booting");
        const { data, error: fnErr } = await supabase.functions.invoke("setup-demo", {
          body: {},
        });
        if (fnErr) throw fnErr;
        if (!data?.email || !data?.password) throw new Error("invalid_response");

        // 2) Sign the visitor in as the demo viewer
        setStatus("signing_in");
        // Sign out any existing session first so we always land as the demo viewer
        await supabase.auth.signOut().catch(() => {});
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signErr) throw signErr;

        if (!cancelled) {
          setStatus("ready");
          navigate(`/demo/internal-dashboard`, { replace: true });
        }
      } catch (e) {
        console.error("Demo init failed", e);
        if (!cancelled) {
          setError((e as Error).message || "حدث خطأ أثناء تجهيز العرض التجريبي");
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6"
    >
      <div className="max-w-lg w-full bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-emerald-100 p-10 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            جمعية النموذج الخيرية
          </h1>
          <p className="text-emerald-600 font-bold flex items-center justify-center gap-2">
            <Eye className="w-4 h-4" />
            عرض تجريبي للاطلاع فقط
          </p>
        </div>
        <p className="text-slate-600 leading-relaxed">
          مرحباً بك في النسخة التجريبية من المنصة — جميع البيانات افتراضية،
          والوضع للاستعراض البصري فقط دون أي صلاحية للتعديل أو الحذف أو
          التصدير.
        </p>

        {status !== "error" && (
          <div className="flex items-center justify-center gap-3 text-emerald-700 font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>
              {status === "booting" && "جارٍ تجهيز بيئة العرض..."}
              {status === "signing_in" && "جارٍ الدخول كمشاهد..."}
              {status === "ready" && "جارٍ التحويل إلى لوحة الجمعية..."}
            </span>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
            تعذّر تجهيز العرض التجريبي: {error}
            <button
              onClick={() => window.location.reload()}
              className="block mt-3 mx-auto px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700"
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
