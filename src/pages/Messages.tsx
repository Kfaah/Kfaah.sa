import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, MessageCircle, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

type Thread = {
  id: string;
  subject: string | null;
  organization_id: string;
  last_message_at: string;
};
type Msg = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
};

export default function Messages() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?next=/messages");
      return;
    }
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    // Find user's organization (first approved membership)
    const { data: org } = await supabase
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("approval_status", "approved")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    const _orgId = (org as any)?.organization_id ?? null;
    setOrgId(_orgId);

    // Fetch most recent thread for this member
    const { data: t } = await supabase
      .from("internal_threads")
      .select("id,subject,organization_id,last_message_at")
      .eq("member_user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setThread((t as Thread) ?? null);

    if (t) {
      const { data: msgs } = await supabase
        .from("internal_messages")
        .select("id,thread_id,sender_user_id,from_admin,body,created_at")
        .eq("thread_id", (t as any).id)
        .order("created_at", { ascending: true });
      setMessages((msgs as Msg[]) || []);

      // mark as read for member
      await supabase
        .from("internal_threads")
        .update({ unread_for_member: false })
        .eq("id", (t as any).id);
    } else {
      setMessages([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("internal-messages-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_threads" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!user) return;
    if (!body.trim()) {
      toast.error("اكتب رسالتك أولاً");
      return;
    }
    if (!orgId) {
      toast.error("لم يتم العثور على جمعيتك");
      return;
    }
    setSending(true);
    try {
      let threadId = thread?.id;
      if (!threadId) {
        const { data: created, error: tErr } = await supabase
          .from("internal_threads")
          .insert({
            organization_id: orgId,
            member_user_id: user.id,
            subject: subject.trim().slice(0, 200) || "رسالة من العضو",
          })
          .select("id,subject,organization_id,last_message_at")
          .single();
        if (tErr) throw tErr;
        threadId = (created as any).id;
        setThread(created as Thread);
      }
      const { error } = await supabase.from("internal_messages").insert({
        thread_id: threadId,
        sender_user_id: user.id,
        from_admin: false,
        body: body.trim().slice(0, 5000),
      });
      if (error) throw error;
      setBody("");
      setSubject("");
      toast.success("تم الإرسال");
      load();
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  return (
    <div
      dir="rtl"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)",
      }}
    >
      <SpaceScene />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl"
        >
          <button
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />
            العودة
          </button>

          <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)] overflow-hidden">
            <div
              className="px-6 py-5 flex items-center gap-3 border-b border-white/10"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.35), hsl(${accentHsl} / 0.18))` }}
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-black/30">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <div className="text-base font-extrabold text-white">محادثتي مع فريق كفاءة</div>
                <div className="text-[11px] text-slate-300 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" style={{ color: `hsl(${accentHsl})` }} />
                  ردود فورية، آمنة، داخل حسابك
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="max-h-[55vh] min-h-[40vh] overflow-y-auto px-5 py-5 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-slate-300">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-300 text-sm">
                  ابدأ محادثتك — اكتب رسالتك الأولى في الأسفل وسنرد عليك بأسرع وقت.
                </div>
              ) : (
                messages.map((it) => {
                  const mine = !it.from_admin;
                  return (
                    <div key={it.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border shadow-sm ${
                          mine
                            ? "bg-white/[0.08] border-white/15 text-white"
                            : "border-amber-300/30 text-white"
                        }`}
                        style={
                          !mine
                            ? { background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.55), hsl(${accentHsl} / 0.25))` }
                            : undefined
                        }
                      >
                        <div className="whitespace-pre-wrap">{it.body}</div>
                        <div className="text-[10px] text-slate-300/80 mt-1.5 text-left" dir="ltr">{fmt(it.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/10 p-4 space-y-2 bg-white/[0.02]">
              {!thread && (
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="موضوع الرسالة (اختياري)"
                  maxLength={200}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                />
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب رسالتك..."
                  rows={2}
                  maxLength={5000}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none"
                />
                <button
                  onClick={send}
                  disabled={sending}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 disabled:opacity-60 hover:-translate-y-0.5 transition-all"
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