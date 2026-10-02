import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ChevronRight, Loader2, Send, Sparkles, PenSquare, Inbox, RefreshCw, Reply, ArrowRight } from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { EmailMessageBody } from "@/components/EmailMessageBody";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

type Thread = {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  last_message_at: string;
  unread_for_owner: boolean;
};
type Message = {
  id: string;
  direction: "outbound" | "inbound";
  sender_email: string;
  recipient_email: string | null;
  subject: string | null;
  body: string;
  received_at: string;
  raw_headers?: { from_name?: string | null } | null;
};

type View = "list" | "compose" | "thread";

export default function PlatformMail() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("list");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("platform_email_threads")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (!error && data) setThreads(data as Thread[]);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    const { data } = await supabase
      .from("platform_email_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("received_at", { ascending: true });
    if (data) setMessages(data as Message[]);
  }, []);

  useEffect(() => {
    loadThreads();
    const ch = supabase
      .channel("platform-mail")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_email_threads" }, () => loadThreads())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_email_messages" }, (p: any) => {
        if (activeThread && p.new.thread_id === activeThread.id) loadMessages(activeThread.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadThreads, loadMessages, activeThread]);

  const openThread = async (t: Thread) => {
    setActiveThread(t);
    setView("thread");
    await loadMessages(t.id);
    if (t.unread_for_owner) {
      await supabase.from("platform_email_threads").update({ unread_for_owner: false }).eq("id", t.id);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-platform-email-replies", { body: {} });
      if (error) throw error;
      const s = (data as any)?.stats;
      toast.success(s ? `تمت المزامنة — جديد: ${s.inserted}، متجاهل: ${s.skipped}` : "تمت المزامنة");
      await loadThreads();
    } catch (e: any) {
      toast.error(e?.message || "تعذّرت المزامنة");
    } finally {
      setSyncing(false);
    }
  };

  const sendOutbound = async (toEmail: string, subject: string, body: string, threadId?: string, inReplyTo?: string) => {
    const messageId = `${crypto.randomUUID()}@kfaah.sa`;
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "platform-mail",
        recipientEmail: toEmail,
        messageId,
        templateData: { subject, body, recipientName: toEmail },
      },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);

    let tId = threadId;
    if (!tId) {
      const { data: t } = await supabase
        .from("platform_email_threads")
        .insert({ recipient_email: toEmail.toLowerCase(), subject, last_message_at: new Date().toISOString() })
        .select("id").single();
      tId = t?.id;
    }
    if (tId) {
      await supabase.from("platform_email_messages").insert({
        thread_id: tId,
        direction: "outbound",
        sender_email: "info@kfaah.sa",
        recipient_email: toEmail.toLowerCase(),
        subject,
        body,
        provider_message_id: messageId,
        in_reply_to: inReplyTo || null,
      });
    }
    return tId;
  };

  const send = async () => {
    if (!compose.to.trim() || !compose.subject.trim()) {
      toast.error("أدخل المستلم والموضوع"); return;
    }
    setSending(true);
    try {
      await sendOutbound(compose.to.trim(), compose.subject.trim(), compose.body);
      toast.success("تم إرسال الرسالة ✉️");
      setCompose({ to: "", subject: "", body: "" });
      setView("list");
      await loadThreads();
    } catch (e: any) { toast.error(e?.message || "تعذّر الإرسال"); }
    finally { setSending(false); }
  };

  const sendReply = async () => {
    if (!activeThread || !replyBody.trim()) return;
    setSending(true);
    try {
      const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");
      const subject = activeThread.subject.startsWith("Re:") ? activeThread.subject : `Re: ${activeThread.subject}`;
      await sendOutbound(activeThread.recipient_email, subject, replyBody, activeThread.id, (lastInbound as any)?.provider_message_id);
      setReplyBody("");
      toast.success("تم إرسال الرد");
      await loadMessages(activeThread.id);
    } catch (e: any) { toast.error(e?.message || "تعذّر الإرسال"); }
    finally { setSending(false); }
  };

  return (
    <div dir="rtl" className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}>
      <SpaceScene />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => view === "list" ? navigate("/") : setView("list")}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
              <ChevronRight className="w-4 h-4" />
              {view === "list" ? "العودة" : "الصندوق"}
            </button>
            <div className="text-right">
              <div className="text-base font-extrabold text-white inline-flex items-center gap-2">
                <Mail className="w-5 h-5" style={{ color: `hsl(${accentHsl})` }} />
                بريد منصة كفاءة
              </div>
              <div className="text-[11px] text-slate-300 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" style={{ color: `hsl(${accentHsl})` }} />
                info@kfaah.sa — استقبال الردود مباشرةً داخل المنصة
              </div>
            </div>
          </div>

          {view === "list" && (
            <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)] overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2 border-b border-white/10 justify-between"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.5), hsl(${accentHsl} / 0.25))` }}>
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-white" />
                  <div className="text-sm font-extrabold text-white">صندوق الوارد والمحادثات</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={syncNow} disabled={syncing}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 disabled:opacity-60">
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    مزامنة
                  </button>
                  <button onClick={() => setView("compose")}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
                    <PenSquare className="w-3.5 h-3.5" />
                    رسالة جديدة
                  </button>
                </div>
              </div>
              <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 text-white animate-spin" /></div>
                ) : threads.length === 0 ? (
                  <div className="p-10 text-center text-slate-300 text-sm">
                    لا توجد محادثات بعد. أرسل رسالة أو انتظر وصول الردود من info@kfaah.sa
                  </div>
                ) : threads.map((t) => (
                  <button key={t.id} onClick={() => openThread(t)}
                    className="w-full px-5 py-3 hover:bg-white/5 transition-colors text-right flex items-center gap-3">
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {t.unread_for_owner && <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${accentHsl})` }} />}
                        <div className="text-sm font-bold text-white truncate">{t.recipient_name || t.recipient_email}</div>
                      </div>
                      <div className="text-xs text-slate-300 truncate mt-0.5">{t.subject}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 shrink-0">
                      {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true, locale: arSA })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {view === "compose" && (
            <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2 border-b border-white/10"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.5), hsl(${accentHsl} / 0.25))` }}>
                <PenSquare className="w-4 h-4 text-white" />
                <div className="text-sm font-extrabold text-white">رسالة جديدة من info@kfaah.sa</div>
              </div>
              <div className="p-5 space-y-3">
                <Input placeholder="إلى (البريد الإلكتروني)" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" dir="ltr" />
                <Input placeholder="الموضوع" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                <Textarea placeholder="اكتب رسالتك..." value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                  rows={12} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none" />
                <div className="flex justify-end">
                  <button onClick={send} disabled={sending}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    إرسال
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === "thread" && activeThread && (
            <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/10"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.5), hsl(${accentHsl} / 0.25))` }}>
                <div className="text-sm font-extrabold text-white">{activeThread.subject}</div>
                <div className="text-[11px] text-slate-200 mt-0.5" dir="ltr">{activeThread.recipient_email}</div>
              </div>
              <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-2xl p-4 border ${m.direction === "inbound"
                    ? "bg-white/[0.07] border-white/10" : "bg-emerald-500/10 border-emerald-400/20"}`}>
                    <div className="flex items-center justify-between mb-2 text-[11px] text-slate-300">
                        <span className="font-bold" dir="auto">{m.raw_headers?.from_name || (m.direction === "inbound" ? activeThread.recipient_name : "منصة كفاءة") || m.sender_email}</span>
                      <span>{formatDistanceToNow(new Date(m.received_at), { addSuffix: true, locale: arSA })}</span>
                    </div>
                    <EmailMessageBody body={m.body} />
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 p-4 space-y-2">
                <Textarea placeholder="اكتب ردك..." value={replyBody} onChange={(e) => setReplyBody(e.target.value)}
                  rows={4} className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none" />
                <div className="flex justify-end">
                  <button onClick={sendReply} disabled={sending || !replyBody.trim()}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Reply className="w-4 h-4" />}
                    إرسال الرد
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
