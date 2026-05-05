import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Inbox, Send, ChevronRight, Sparkles, Loader2, Search, RefreshCw,
  PenSquare, Archive, Trash2, CornerUpLeft, X, Star
} from "lucide-react";
import SpaceScene from "@/components/space/SpaceScene";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

type MsgMeta = {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  unread: boolean;
  from: string;
  to: string;
  subject: string;
  date: string;
  internalDate: string;
};

type MsgFull = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  headers: Record<string, string>;
  html: string | null;
  text: string | null;
};

type Folder = "inbox" | "sent" | "starred" | "trash";

const folderQuery: Record<Folder, string> = {
  inbox: "in:inbox",
  sent: "in:sent",
  starred: "is:starred",
  trash: "in:trash",
};

const folderLabels: Record<Folder, { name: string; icon: any }> = {
  inbox: { name: "الوارد", icon: Inbox },
  sent: { name: "المرسل", icon: Send },
  starred: { name: "المميّز", icon: Star },
  trash: { name: "المهملات", icon: Trash2 },
};

function parseFrom(raw: string) {
  const m = raw.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
  return { name: (m?.[1] || raw).trim() || raw, email: (m?.[2] || raw).trim() };
}

function formatDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same
    ? d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ar-SA", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function PlatformMail() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [folder, setFolder] = useState<Folder>("inbox");
  const [search, setSearch] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [messages, setMessages] = useState<MsgMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MsgFull | null>(null);
  const [opening, setOpening] = useState(false);
  const [profileEmail, setProfileEmail] = useState<string>("");

  // Compose
  const [composing, setComposing] = useState(false);
  const [cTo, setCTo] = useState("");
  const [cSubj, setCSubj] = useState("");
  const [cBody, setCBody] = useState("");
  const [cReply, setCReply] = useState<{ id?: string; threadId?: string; references?: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth?next=/platform-mail");
  }, [user, authLoading, navigate]);

  const call = async (action: string, payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("gmail-api", { body: { action, ...payload } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data?.result;
  };

  const loadProfile = async () => {
    try { const p = await call("profile"); setProfileEmail(p?.emailAddress || ""); } catch {}
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const q = [folderQuery[folder], appliedQuery].filter(Boolean).join(" ");
      const r = await call("list", { q, maxResults: 30 });
      setMessages(r.messages || []);
    } catch (e: any) {
      toast.error("تعذّر تحميل الرسائل: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadProfile();
  // eslint-disable-next-line
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    loadList();
    setSelected(null);
  // eslint-disable-next-line
  }, [user?.id, folder, appliedQuery]);

  const open = async (m: MsgMeta) => {
    setOpening(true);
    setSelected(null);
    try {
      const full = await call("get", { id: m.id });
      setSelected(full);
      if (m.unread) {
        await call("modify", { id: m.id, removeLabelIds: ["UNREAD"] }).catch(() => {});
        setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, unread: false } : x));
      }
    } catch (e: any) {
      toast.error("تعذّر فتح الرسالة: " + (e?.message || ""));
    } finally { setOpening(false); }
  };

  const trashMsg = async (id: string) => {
    try {
      await call("trash", { id });
      setMessages((p) => p.filter((x) => x.id !== id));
      setSelected(null);
      toast.success("تم النقل إلى المهملات");
    } catch (e: any) { toast.error(e?.message || "فشل"); }
  };

  const archiveMsg = async (id: string) => {
    try {
      await call("modify", { id, removeLabelIds: ["INBOX"] });
      setMessages((p) => p.filter((x) => x.id !== id));
      setSelected(null);
      toast.success("تم الأرشفة");
    } catch (e: any) { toast.error(e?.message || "فشل"); }
  };

  const startCompose = () => {
    setCReply(null); setCTo(""); setCSubj(""); setCBody(""); setComposing(true);
  };
  const startReply = () => {
    if (!selected) return;
    const from = parseFrom(selected.headers["from"] || "");
    setCReply({
      id: selected.id,
      threadId: selected.threadId,
      references: selected.headers["message-id"],
    });
    setCTo(from.email);
    setCSubj((selected.headers["subject"] || "").startsWith("Re:") ? selected.headers["subject"] : "Re: " + (selected.headers["subject"] || ""));
    setCBody("");
    setComposing(true);
  };

  const sendMail = async () => {
    if (!cTo.trim() || !cBody.trim()) { toast.error("أدخل المستلم والمحتوى"); return; }
    setSending(true);
    try {
      await call("send", {
        to: cTo.trim(),
        subject: cSubj.trim(),
        body: cBody.replace(/\n/g, "<br/>"),
        threadId: cReply?.threadId,
        inReplyTo: cReply?.references,
        references: cReply?.references,
      });
      toast.success("تم الإرسال");
      setComposing(false);
      if (folder === "sent") loadList();
    } catch (e: any) {
      toast.error("فشل الإرسال: " + (e?.message || ""));
    } finally { setSending(false); }
  };

  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); setAppliedQuery(search.trim()); };

  return (
    <div
      dir="rtl"
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}
    >
      <SpaceScene />
      <main className="relative z-10 flex-1 flex flex-col px-4 py-6 md:py-10">
        {/* Header */}
        <div className="max-w-7xl w-full mx-auto mb-4">
          <button onClick={() => navigate("/")} className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white">
            <ChevronRight className="w-4 h-4" /> العودة
          </button>
          <div className="rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3 border border-white/10 backdrop-blur-xl"
            style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.35), hsl(${accentHsl} / 0.18))` }}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-black/30">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div className="text-right flex-1 min-w-[180px]">
              <div className="text-base font-extrabold text-white">بريد كفاءة الرسمي</div>
              <div className="text-[11px] text-slate-300 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" style={{ color: `hsl(${accentHsl})` }} />
                {profileEmail || "info@kfaah.org"}
              </div>
            </div>
            <form onSubmit={submitSearch} className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث... (مثال: from:user@x.com)"
                  className="pr-9 bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
              </div>
            </form>
            <button onClick={loadList} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15" title="تحديث">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={startCompose} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg shadow-black/30 hover:-translate-y-0.5 transition-all"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
              <PenSquare className="w-4 h-4" /> إنشاء
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-w-7xl w-full mx-auto grid grid-cols-12 gap-3 flex-1">
          {/* Sidebar folders */}
          <aside className="col-span-12 md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-2 h-fit">
            {(Object.keys(folderLabels) as Folder[]).map((k) => {
              const Ico = folderLabels[k].icon;
              const active = folder === k;
              return (
                <button key={k} onClick={() => setFolder(k)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-right ${active ? "text-white shadow-lg" : "text-slate-300 hover:bg-white/10"}`}
                  style={active ? { background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` } : {}}>
                  <Ico className="w-4 h-4" /> {folderLabels[k].name}
                </button>
              );
            })}
          </aside>

          {/* List */}
          <section className="col-span-12 md:col-span-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden flex flex-col max-h-[70vh]">
            <div className="px-4 py-2 text-xs text-slate-400 border-b border-white/10">
              {loading ? "جاري التحميل..." : `${messages.length} رسالة`}
            </div>
            <div className="overflow-y-auto flex-1">
              {messages.length === 0 && !loading && (
                <div className="text-center text-slate-400 text-sm py-12">لا توجد رسائل</div>
              )}
              {messages.map((m) => {
                const f = parseFrom(m.from);
                const isSel = selected?.id === m.id;
                return (
                  <button key={m.id} onClick={() => open(m)}
                    className={`w-full text-right px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all ${isSel ? "bg-white/10" : ""}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className={`text-sm truncate flex-1 ${m.unread ? "font-extrabold text-white" : "font-medium text-slate-300"}`}>{f.name}</div>
                      <div className="text-[10px] text-slate-400 shrink-0" dir="ltr">{formatDate(m.date)}</div>
                    </div>
                    <div className={`text-xs truncate ${m.unread ? "text-white" : "text-slate-400"}`}>{m.subject}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{m.snippet}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Reader */}
          <section className="col-span-12 md:col-span-6 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden flex flex-col max-h-[70vh]">
            {opening && (
              <div className="flex-1 flex items-center justify-center text-slate-300"><Loader2 className="w-5 h-5 animate-spin" /></div>
            )}
            {!opening && !selected && (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">اختر رسالة لعرضها</div>
            )}
            {selected && (
              <>
                <div className="px-5 py-4 border-b border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-base font-extrabold text-white flex-1 truncate">{selected.headers["subject"] || "(بدون موضوع)"}</div>
                    <div className="flex items-center gap-1">
                      <button onClick={startReply} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white" title="رد"><CornerUpLeft className="w-4 h-4" /></button>
                      <button onClick={() => archiveMsg(selected.id)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white" title="أرشفة"><Archive className="w-4 h-4" /></button>
                      <button onClick={() => trashMsg(selected.id)} className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200" title="حذف"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-300">
                    <span className="font-bold">من:</span> {selected.headers["from"]}
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="font-bold">إلى:</span> {selected.headers["to"]}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1" dir="ltr">{selected.headers["date"]}</div>
                </div>
                <div className="overflow-y-auto flex-1 p-5 bg-white/5">
                  {selected.html ? (
                    <div className="bg-white text-black rounded-xl p-4 text-sm" dangerouslySetInnerHTML={{ __html: selected.html }} />
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-white leading-relaxed font-sans">{selected.text || selected.snippet}</pre>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Compose modal */}
      <AnimatePresence>
        {composing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-950/90 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between border-b border-white/10"
                style={{ background: `linear-gradient(135deg, hsl(${primaryHsl} / 0.4), hsl(${accentHsl} / 0.2))` }}>
                <div className="text-sm font-extrabold text-white">{cReply ? "رد على الرسالة" : "رسالة جديدة"}</div>
                <button onClick={() => setComposing(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-3">
                <Input value={cTo} onChange={(e) => setCTo(e.target.value)} placeholder="إلى (email@example.com)"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" dir="ltr" />
                <Input value={cSubj} onChange={(e) => setCSubj(e.target.value)} placeholder="الموضوع"
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400" />
                <Textarea value={cBody} onChange={(e) => setCBody(e.target.value)} placeholder="اكتب رسالتك..." rows={9}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-400 resize-none" />
                <div className="flex justify-end pt-2">
                  <button onClick={sendMail} disabled={sending}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/30 disabled:opacity-60 hover:-translate-y-0.5 transition-all"
                    style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
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
