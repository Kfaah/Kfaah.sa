import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Inbox, Search, Mail, Phone, MessageCircle, Send, ArrowRight,
  Clock, CheckCircle2, Trash2, Filter, RefreshCcw, User2, Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const primaryHsl = "168 76% 28%";
const accentHsl = "44 92% 55%";

type SupportMsg = {
  id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  organization_name: string | null;
  subject: string;
  message: string;
  category: string;
  status: string;
  is_read: boolean;
  created_at: string;
};

type Reply = {
  id: string;
  body: string;
  from_owner: boolean;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  open: "قيد المعالجة",
  resolved: "تم الحل",
  closed: "مغلق",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "استفسار عام",
  technical: "مشكلة تقنية",
  subscription: "الاشتراك",
  purchase: "شراء وتملّك",
  training: "تدريب",
  other: "أخرى",
};

export default function SupportInbox() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "new" | "open" | "resolved">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      setIsOwner(!!data);
    })();
  }, [user, authLoading, navigate]);

  const loadMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("تعذّر تحميل الرسائل");
    } else {
      setMessages((data as SupportMsg[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOwner) loadMessages();
  }, [isOwner]);

  // Realtime
  useEffect(() => {
    if (!isOwner) return;
    const ch = supabase
      .channel("support_messages_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        loadMessages();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isOwner]);

  const loadReplies = async (msgId: string) => {
    const { data } = await supabase
      .from("support_replies")
      .select("*")
      .eq("message_id", msgId)
      .order("created_at", { ascending: true });
    setReplies((data as Reply[]) || []);
  };

  const selectMessage = async (msg: SupportMsg) => {
    setSelectedId(msg.id);
    setReplyText("");
    await loadReplies(msg.id);
    if (!msg.is_read) {
      await supabase.from("support_messages").update({ is_read: true, status: msg.status === "new" ? "open" : msg.status }).eq("id", msg.id);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_read: true, status: m.status === "new" ? "open" : m.status } : m)));
    }
  };

  const sendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("support_replies").insert({
        message_id: selectedId,
        body: replyText.trim().slice(0, 5000),
        from_owner: true,
        author_user_id: user!.id,
      });
      if (error) throw error;
      setReplyText("");
      await loadReplies(selectedId);
      toast.success("تم حفظ الرد");
    } catch (err: any) {
      toast.error(err?.message || "تعذّر إرسال الرد");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("support_messages").update({ status }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    toast.success("تم تحديث الحالة");
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("حذف هذه الرسالة نهائياً؟")) return;
    await supabase.from("support_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success("تم الحذف");
  };

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (filter === "unread" && m.is_read) return false;
      if (["new", "open", "resolved"].includes(filter) && m.status !== filter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (
          !m.sender_name.toLowerCase().includes(s) &&
          !m.sender_email.toLowerCase().includes(s) &&
          !m.subject.toLowerCase().includes(s) &&
          !m.message.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [messages, filter, search]);

  const selected = messages.find((m) => m.id === selectedId) || null;
  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (authLoading || isOwner === null) {
    return <div dir="rtl" className="min-h-screen flex items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;
  }

  if (!isOwner) {
    return (
      <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">صفحة محصورة</h1>
        <p className="text-muted-foreground mb-4">هذه الصفحة متاحة فقط لمالك المنصة.</p>
        <button onClick={() => navigate("/")} className="text-primary font-bold">العودة للرئيسية</button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-extrabold text-slate-800">صندوق رسائل الدعم</h1>
              <p className="text-xs text-slate-500">
                {messages.length} رسالة — {unreadCount} غير مقروءة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadMessages} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" title="تحديث">
              <RefreshCcw className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => navigate("/")} className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100">
              للرئيسية
              <ArrowRight className="inline w-3 h-3 mr-1 rotate-180" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* List */}
        <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-110px)]">
          {/* Search + Filters */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="بحث في الرسائل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9 bg-slate-50 border-slate-200"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "الكل" },
                { id: "unread", label: `غير مقروءة (${unreadCount})` },
                { id: "new", label: "جديد" },
                { id: "open", label: "قيد المعالجة" },
                { id: "resolved", label: "محلولة" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                    filter === f.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">جارٍ التحميل...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">لا توجد رسائل</p>
              </div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMessage(m)}
                  className={`w-full text-right p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedId === m.id ? "bg-emerald-50/60 border-r-4 border-r-emerald-500" : ""
                  } ${!m.is_read ? "bg-amber-50/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!m.is_read && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                      <span className="font-bold text-sm text-slate-800 truncate">{m.sender_name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{formatDate(m.created_at)}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 truncate mb-1">{m.subject}</div>
                  <div className="text-xs text-slate-500 line-clamp-2 mb-2">{m.message}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {CATEGORY_LABEL[m.category] || m.category}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor(m.status)}`}>
                      {STATUS_LABEL[m.status] || m.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Detail */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-110px)]">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Mail className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500">اختر رسالة لعرض تفاصيلها والرد عليها</p>
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800 mb-1">{selected.subject}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><User2 className="w-3 h-3" />{selected.sender_name}</span>
                      {selected.organization_name && (
                        <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{selected.organization_name}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateFull(selected.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={selected.status}
                      onChange={(e) => updateStatus(selected.id, e.target.value)}
                      className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <button onClick={() => deleteMessage(selected.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="حذف">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`mailto:${selected.sender_email}?subject=${encodeURIComponent("رد: " + selected.subject)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    {selected.sender_email}
                  </a>
                  {selected.sender_phone && (
                    <>
                      <a href={`tel:+966${selected.sender_phone.replace(/^0/, "")}`} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors">
                        <Phone className="w-3 h-3" />
                        {selected.sender_phone}
                      </a>
                      <a
                        href={`https://wa.me/966${selected.sender_phone.replace(/^0/, "")}?text=${encodeURIComponent(`السلام عليكم ${selected.sender_name}،\n\nبخصوص رسالتك "${selected.subject}":\n`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" />
                        واتساب
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Conversation */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-400 mb-2">الرسالة الأصلية</div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                </div>
                {replies.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-2xl p-4 border shadow-sm ${
                      r.from_owner ? "bg-emerald-50/70 border-emerald-200 mr-8" : "bg-white border-slate-200 ml-8"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">
                        {r.from_owner ? "ردّك" : selected.sender_name}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDateFull(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="p-4 border-t border-slate-100 bg-white">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب ردك هنا... (سيتم حفظه في سجل المحادثة)"
                  rows={3}
                  maxLength={5000}
                  className="resize-none mb-2"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400">
                    💡 للرد المباشر على المرسل، استخدم زر البريد أو واتساب أعلاه. الرد هنا للسجل الداخلي.
                  </p>
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    حفظ الرد
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function statusColor(s: string) {
  switch (s) {
    case "new": return "bg-amber-100 text-amber-700";
    case "open": return "bg-cyan-100 text-cyan-700";
    case "resolved": return "bg-emerald-100 text-emerald-700";
    case "closed": return "bg-slate-200 text-slate-600";
    default: return "bg-slate-100 text-slate-600";
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ي`;
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function formatDateFull(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}