import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ChevronRight, Loader2, Send, Sparkles, PenSquare, Inbox } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

export default function PlatformMail() {
  const navigate = useNavigate();
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!compose.to.trim() || !compose.subject.trim()) {
      toast.error("أدخل المستلم والموضوع");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "platform-mail",
          recipientEmail: compose.to.trim(),
          templateData: {
            subject: compose.subject.trim(),
            body: compose.body,
            recipientName: compose.to.trim(),
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("تم إرسال الرسالة ✉️");
      setCompose({ to: "", subject: "", body: "" });
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}
    >
      <SpaceScene />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
              <ChevronRight className="w-4 h-4" />
              العودة
            </button>
            <div className="text-right">
              <div className="text-base font-extrabold text-white inline-flex items-center gap-2">
                <Mail className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                بريد كفاءة الرسمي
              </div>
              <div className="text-[11px] text-slate-300 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" style={{ color: `hsl(${accentHsl})` }} />
                info@kfaah.org — إرسال مباشر من المنصة
              </div>
            </div>
          </div>

          {/* Inbox notice */}
          <div className="rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/15 p-4 mb-4 flex items-center justify-between gap-3">
            <div className="text-right">
              <div className="text-sm font-extrabold text-white">الاستقبال داخل المنصة</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                الرسائل الواردة من نماذج التواصل تظهر مباشرة في صندوق بريد كفاءة داخل المنصة، بدون الاعتماد على Zoho.
              </div>
            </div>
            <button
              onClick={() => navigate("/inbox")}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg shadow-black/30 hover:-translate-y-0.5 transition-all"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              <Inbox className="w-4 h-4" />
              فتح الوارد
            </button>
          </div>

          {/* Composer */}
          <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)] overflow-hidden">
            <div
              className="px-5 py-3 flex items-center gap-2 border-b border-white/10"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.5), hsl(${accentHsl} / 0.25))` }}
            >
              <PenSquare className="w-4 h-4 text-white" />
              <div className="text-sm font-extrabold text-white">رسالة جديدة من info@kfaah.org</div>
            </div>
            <div className="p-5 space-y-3">
              <Input
                placeholder="إلى (البريد الإلكتروني)"
                value={compose.to}
                onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                dir="ltr"
              />
              <Input
                placeholder="الموضوع"
                value={compose.subject}
                onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
              />
              <Textarea
                placeholder="اكتب رسالتك..."
                value={compose.body}
                onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                rows={12}
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={send}
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
