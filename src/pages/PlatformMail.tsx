import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ChevronRight, Loader2, Inbox, Send, RefreshCw, X, Reply, Trash2, PenSquare, Sparkles, Paperclip,
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

type Addr = { name?: string; address?: string };
type MsgItem = {
  uid: number;
  subject: string;
  from: Addr | null;
  to: Addr[];
  date: string;
  seen: boolean;
};
type FullMsg = {
  uid: number;
  subject: string;
  from: Addr | null;
  to: Addr[];
  date: string;
  text: string;
  html: string;
  attachments: { filename: string; contentType: string; size: number }[];
};

const FOLDERS = [
  { id: "INBOX", label: "الوارد", icon: Inbox },
  { id: "Sent", label: "الصادر", icon: Send },
];

export default function PlatformMail() {
  const navigate = useNavigate();
  const [folder, setFolder] = useState("INBOX");
  const [list, setList] = useState<MsgItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openMsg, setOpenMsg] = useState<FullMsg | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const load = async (mailbox = folder) => {
    setLoading(true);
    setOpenMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-mail", {
        body: { action: "list", mailbox, limit: 40 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setList((data as any).messages || []);
      setTotal((data as any).total || 0);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر تحميل الرسائل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(folder); /* eslint-disable-next-line */ }, [folder]);

  const open = async (uid: number) => {
    setOpenLoading(true);
    setOpenMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-mail", {
        body: { action: "get", mailbox: folder, uid },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setOpenMsg(data as FullMsg);
      setList((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
    } catch (e: any) {
      toast.error(e?.message || "تعذّر فتح الرسالة");
    } finally {
      setOpenLoading(false);
    }
  };

  const send = async () => {
    if (!compose.to.trim() || !compose.subject.trim()) {
      toast.error("أدخل المستلم والموضوع");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-mail", {
        body: {
          action: "send",
          to: compose.to.trim(),
          subject: compose.subject.trim(),
          text: compose.body,
          html: compose.body.replace(/\n/g, "<br/>"),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("تم إرسال الرسالة ✉️");
      setComposing(false);
      setCompose({ to: "", subject: "", body: "" });
      if (folder === "Sent") load("Sent");
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  };

  const remove = async (uid: number) => {
    if (!confirm("حذف هذه الرسالة؟")) return;
    try {
      const { data, error } = await supabase.functions.invoke("zoho-mail", {
        body: { action: "delete", mailbox: folder, uid },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("تم الحذف");
      setOpenMsg(null);
      setList((prev) => prev.filter((m) => m.uid !== uid));
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الحذف");
    }
  };

  const reply = (m: FullMsg) => {
    setCompose({
      to: m.from?.address || "",
      subject: m.subject?.startsWith("Re:") ? m.subject : `Re: ${m.subject}`,
      body: `\n\n---------- الرسالة الأصلية ----------\nمن: ${m.from?.name || ""} <${m.from?.address || ""}>\nالتاريخ: ${new Date(m.date).toLocaleString("ar-SA")}\nالموضوع: ${m.subject}\n\n${m.text || ""}`,
    });
    setComposing(true);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div
      dir="rtl"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}
    >
      <SpaceScene />
      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-6xl">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
            >
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
                info@kfaah.org — Zoho Mail
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.05] backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-20px_hsl(220_75%_3%/0.9)] overflow-hidden">
            <div className="grid grid-cols-12 min-h-[70vh]">
              {/* Sidebar */}
              <aside className="col-span-2 border-l border-white/10 p-3 space-y-2 bg-white/[0.02]">
                <button
                  onClick={() => setComposing(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-white shadow-lg shadow-black/30 hover:-translate-y-0.5 transition-all"
                  style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                >
                  <PenSquare className="w-4 h-4" />
                  رسالة جديدة
                </button>
                <div className="pt-2 space-y-1">
                  {FOLDERS.map((f) => {
                    const Icon = f.icon;
                    const active = folder === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFolder(f.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                          active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => load()}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-300 border border-white/10 hover:text-white hover:bg-white/[0.06]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  تحديث
                </button>
              </aside>

              {/* List */}
              <section className="col-span-4 border-l border-white/10 max-h-[70vh] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : list.length === 0 ? (
                  <div className="text-center py-16 text-sm text-slate-300">لا توجد رسائل</div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {list.map((m) => {
                      const isOpen = openMsg?.uid === m.uid;
                      return (
                        <li
                          key={m.uid}
                          onClick={() => open(m.uid)}
                          className={`px-4 py-3 cursor-pointer transition-colors ${
                            isOpen ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs ${m.seen ? "text-slate-400" : "text-amber-200 font-extrabold"}`}>
                              {m.from?.name || m.from?.address || "—"}
                            </span>
                            <span className="text-[10px] text-slate-400" dir="ltr">{fmt(m.date)}</span>
                          </div>
                          <div className={`text-sm mt-0.5 truncate ${m.seen ? "text-slate-200" : "text-white font-bold"}`}>
                            {m.subject}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5" dir="ltr">{m.from?.address}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {total > 0 && (
                  <div className="text-[10px] text-slate-400 text-center py-2 border-t border-white/5">
                    عرض {list.length} من {total}
                  </div>
                )}
              </section>

              {/* Reader */}
              <section className="col-span-6 max-h-[70vh] overflow-y-auto">
                {openLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-300">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : !openMsg ? (
                  <div className="text-center py-16 text-sm text-slate-300">اختر رسالة لقراءتها</div>
                ) : (
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 text-right">
                        <div className="text-base font-extrabold text-white">{openMsg.subject}</div>
                        <div className="text-xs text-slate-300 mt-1">
                          من: <span className="text-amber-200">{openMsg.from?.name || ""} &lt;{openMsg.from?.address}&gt;</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5" dir="ltr">{fmt(openMsg.date)}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => reply(openMsg)} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08]" title="رد">
                          <Reply className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(openMsg.uid)} className="p-2 rounded-lg text-slate-300 hover:text-red-300 hover:bg-red-500/10" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setOpenMsg(null)} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08]" title="إغلاق">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {openMsg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                        {openMsg.attachments.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-white/[0.06] text-slate-200 border border-white/10">
                            <Paperclip className="w-3 h-3" />
                            {a.filename}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-4">
                      {openMsg.html ? (
                        <div
                          className="prose prose-invert max-w-none text-sm text-slate-100 [&_a]:text-amber-200"
                          dangerouslySetInnerHTML={{ __html: openMsg.html }}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap text-sm text-slate-100 font-sans">{openMsg.text}</pre>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Compose modal */}
      <AnimatePresence>
        {composing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !sending && setComposing(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden"
              dir="rtl"
            >
              <div
                className="px-5 py-3 flex items-center justify-between border-b border-white/10"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.5), hsl(${accentHsl} / 0.25))` }}
              >
                <div className="text-sm font-extrabold text-white inline-flex items-center gap-2">
                  <PenSquare className="w-4 h-4" />
                  رسالة جديدة من info@kfaah.org
                </div>
                <button onClick={() => !sending && setComposing(false)} className="text-slate-200 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
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
                  rows={10}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}