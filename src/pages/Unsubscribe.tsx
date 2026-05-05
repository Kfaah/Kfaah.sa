import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "valid" | "invalid" | "already" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } }
        );
        const data = await res.json();
        if (data?.valid) setState("valid");
        else if (data?.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if ((data as any)?.success) setState("done");
      else if ((data as any)?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <h1 className="text-xl font-extrabold text-slate-800 mb-3">إلغاء الاشتراك</h1>
        {state === "loading" && <p className="text-slate-500">جارٍ التحقق...</p>}
        {state === "invalid" && <p className="text-rose-600">الرابط غير صالح أو منتهي.</p>}
        {state === "error" && <p className="text-rose-600">حدث خطأ. حاول مجدداً.</p>}
        {state === "already" && <p className="text-emerald-700">تم إلغاء اشتراكك مسبقاً.</p>}
        {state === "valid" && (
          <>
            <p className="text-slate-600 mb-5">اضغط لتأكيد إلغاء استلام الرسائل من منصة كفاءة.</p>
            <button
              onClick={confirm}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-white font-bold shadow-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(168 76% 28%), hsl(44 92% 55%))" }}
            >
              {submitting ? "جارٍ التنفيذ..." : "تأكيد إلغاء الاشتراك"}
            </button>
          </>
        )}
        {state === "done" && <p className="text-emerald-700 font-bold">تم إلغاء اشتراكك بنجاح.</p>}
      </div>
    </div>
  );
}