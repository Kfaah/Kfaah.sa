import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Inbox, ChevronRight, Loader2, Reply, PenSquare, MessageCircle, Shield } from "lucide-react";
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
  last_message_at: string;
  unread_for_member: boolean;
};
type Msg = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
};

type Folder = "inbox" | "sent" | "compose";

export default function Messages() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [hasMemberSent, setHasMemberSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth?next=/messages");
  }, [user, authLoading, navigate]);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: t } = await supabase
      .from("internal_threads")
      .select("id,subject,last_message_at,unread_for_member")
      .eq("member_user_id", user.id)
      .order("last_message_at", { ascending: false });
    setThreads((t as Thread[]) || []);
    setLoading(false);
  }, [user]);

  const loadMessages = useCallback(async (tid: string) => {
    const { data } = await supabase
      .from("internal_messages")
      .select("id,thread_id,sender_user_id,from_admin,body,created_at")
      .eq("thread_id", tid)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) || []);
    await supabase.from("internal_threads").update({ unread_for_member: false }).eq("id", tid);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadThreads();
    const ch = supabase
      .channel("internal-messages-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_threads" }, loadThreads)
      .on("postgres_changes", { event: "*", schema: "public", table: "internal_messages" }, () => {
        loadThreads();
        if (selectedId) loadMessages(selectedId);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Determine which threads have at least one message from member (for "sent" folder)
  useEffect(() => {
    (async () => {
      if (!user || threads.length === 0) { setHasMemberSent({}); return; }
      const { data } = await supabase
        .from("internal_messages")
        .select("thread_id,sender_user_id")
        .in("thread_id", threads.map((t) => t.id))
        .eq("sender_user_id", user.id);
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => (map[r.thread_id] = true));
      setHasMemberSent(map);
    })();
  }, [threads, user]);

  const sendReply = async () => {
    if (!user || !selectedId) return;
    if (!body.trim()) return toast.error("اكتب رسالتك أولاً");
    setSending(true);
    try {
      const { error } = await supabase.from("internal_messages").insert({
        thread_id: selectedId,
        sender_user_id: user.id,
        from_admin: false,
        body: body.trim().slice(0, 5000),
      });
      if (error) throw error;
      setBody("");
      loadMessages(selectedId);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإرسال");
    } finally { setSending(false); }
  };

  const sendCompose = async () => {
    if (!user) return;
    if (!composeBody.trim()) return toast.error("اكتب نص الرسالة");
    setSending(true);
    try {
      const { data: created, error: tErr } = await supabase
        .from("internal_threads")
        .insert({
          member_user_id: user.id,
          subject: composeSubject.trim().slice(0, 200) || "تواصل مع إدارة المنصة",
        })
        .select("id")
        .single();
      if (tErr) throw tErr;
      const tid = (created as any).id;
      const { error: mErr } = await supabase.from("internal_messages").insert({
        thread_id: tid,
        sender_user_id: user.id,
        from_admin: false,
        body: composeBody.trim().slice(0, 5000),
      });
      if (mErr) throw mErr;
      toast.success("تم إرسال الرسالة");
      setComposeSubject("");
      setComposeBody("");
      setSelectedId(tid);
      setFolder("sent");
      loadThreads();
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإرسال");
    } finally { setSending(false); }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  const filtered = threads.filter((t) =>
    folder === "inbox" ? true : folder === "sent" ? !!hasMemberSent[t.id] : false
  );
  const selected = threads.find((t) => t.id === selectedId);
  const unreadCount = threads.filter((t) => t.unread_for_member).length;

  const NavBtn = ({ id, icon: Icon, label, count }: any) => (
    <button
      onClick={() => { setFolder(id); if (id === "compose") setSelectedId(null); }}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
        folder === id ? "bg-white/[0.10] text-white" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      <span className="flex items-center gap-2"><Icon className="w-4 h-4" />{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] bg-amber-400/90 text-slate-900 rounded-full px-2 py-0.5">{count}</span>
      )}
    </button>
  );

  return (
    <div
      dir="rtl"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}
    >
      <SpaceScene />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-6xl">
          <button
            onClick={() => navigate("/")}
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ChevronRight className="w-4 h-4" />العودة
          </button>

          <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)] overflow-hidden">
            <div
              className="px-6 py-4 flex items-center gap-3 border-b border-white/10"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.4), hsl(${accentHsl} / 0.18))` }}
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-black/30">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="text-right flex-1">
                <div className="text-base font-extrabold text-white">نظام التواصل</div>
                <div className="text-[11px] text-slate-300 inline-flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  رسائل داخل المنصة من حسابك إلى إدارة المنصة
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px,280px,1fr] min-h-[60vh]">
              <div className="border-l border-white/10 p-3 space-y-1.5">
                <NavBtn id="inbox" icon={Inbox} label="الوارد" count={unreadCount} />
                <NavBtn id="sent" icon={Reply} label="الصادر" />
                <NavBtn id="compose" icon={PenSquare} label="إنشاء رسالة" />
              </div>

              {folder !== "compose" && (
                <div className="border-l border-white/10 max-h-[70vh] overflow-y-auto">
                  {loading ? (
                    <div className="p-8 text-center text-slate-300"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
                  ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">لا توجد رسائل</div>
                  ) : (
                    filtered.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        className={`w-full text-right px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] transition ${selectedId === t.id ? "bg-white/[0.06]" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{t.subject || "بدون موضوع"}</div>
                            <div className="text-[11px] text-slate-400 truncate">إدارة المنصة</div>
                          </div>
                          {folder === "inbox" && t.unread_for_member && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 text-left" dir="ltr">{fmt(t.last_message_at)}</div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {folder === "compose" ? (
                <div className="md:col-span-2 p-6 space-y-3">
                  <div className="text-sm font-bold text-white mb-2">إنشاء رسالة جديدة</div>
                  <div className="text-[11px] text-slate-400 mb-2">المستلم: إدارة المنصة</div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">الموضوع (اختياري)</label>
                    <Input
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      maxLength={200}
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">نص الرسالة</label>
                    <Textarea
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      rows={6}
                      maxLength={5000}
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={sendCompose}
                      disabled={sending}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 disabled:opacity-60"
                      style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      إرسال
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div ref={scrollRef} className="flex-1 max-h-[55vh] overflow-y-auto px-5 py-5 space-y-3">
                    {!selected ? (
                      <div className="text-center py-12 text-slate-400 text-sm">اختر محادثة من القائمة</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-sm">لا توجد رسائل في هذه المحادثة</div>
                    ) : (
                      messages.map((m) => {
                        const mine = !m.from_admin;
                        return (
                          <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                            <div
                              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border shadow-sm ${mine ? "bg-white/[0.08] border-white/15 text-white" : "border-amber-300/30 text-white"}`}
                              style={!mine ? { background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.55), hsl(${accentHsl} / 0.25))` } : undefined}
                            >
                              <div className="whitespace-pre-wrap">{m.body}</div>
                              <div className="text-[10px] text-slate-300/80 mt-1.5 text-left" dir="ltr">{fmt(m.created_at)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {selected && (
                    <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                      <div className="flex items-end gap-2">
                        <Textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          placeholder="اكتب ردّك..."
                          rows={2}
                          maxLength={5000}
                          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none"
                        />
                        <button
                          onClick={sendReply}
                          disabled={sending}
                          className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 disabled:opacity-60"
                          style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                        >
                          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          إرسال
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
