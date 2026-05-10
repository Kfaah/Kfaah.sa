import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Inbox, Search, Mail, Phone, MessageCircle, Send, ArrowRight,
  Clock, Trash2, RefreshCcw, User2, Building2, Star, StarOff,
  Archive, AlertOctagon, FileEdit, PenSquare, Reply, Forward,
  ChevronLeft, MoreHorizontal, CheckCircle2, Filter, Trash, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePreviewMode } from "@/contexts/PreviewModeContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import SpaceScene from "@/components/space/SpaceScene";

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
  is_starred: boolean;
  is_spam: boolean;
  is_trashed: boolean;
  is_archived: boolean;
  labels: string[];
  created_at: string;
  user_id?: string | null;
};

type Reply = {
  id: string;
  message_id: string;
  body: string;
  from_owner: boolean;
  created_at: string;
};

type Draft = {
  id: string;
  to_email: string | null;
  to_name: string | null;
  subject: string | null;
  body: string | null;
  reply_to_message_id: string | null;
  updated_at: string;
};

type FolderId = "inbox" | "starred" | "sent" | "drafts" | "archive" | "spam" | "trash";

const FOLDERS: { id: FolderId; label: string; icon: any; color: string }[] = [
  { id: "inbox", label: "صندوق الوارد", icon: Inbox, color: "text-cyan-300" },
  { id: "starred", label: "المميّزة", icon: Star, color: "text-amber-300" },
  { id: "sent", label: "المُرسَلة", icon: Send, color: "text-emerald-300" },
  { id: "drafts", label: "المسودات", icon: FileEdit, color: "text-slate-300" },
  { id: "archive", label: "الأرشيف", icon: Archive, color: "text-violet-300" },
  { id: "spam", label: "غير الهام", icon: AlertOctagon, color: "text-orange-300" },
  { id: "trash", label: "المحذوفات", icon: Trash2, color: "text-rose-300" },
];

export default function SupportInbox() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPreviewMode } = usePreviewMode();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [allReplies, setAllReplies] = useState<Reply[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pemOutbound, setPemOutbound] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [syncing, setSyncing] = useState(false);

  // Auth
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      if (isPreviewMode) { setIsOwner(true); return; }
      navigate("/auth"); return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      setIsOwner(!!data);
    })();
  }, [user, authLoading, isPreviewMode, navigate]);

  // Loaders
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [msgs, reps, drs, pemT, pemM, pemOut] = await Promise.all([
      supabase.from("support_messages").select("*").order("created_at", { ascending: false }),
      supabase.from("support_replies").select("*").order("created_at", { ascending: true }),
      supabase.from("support_drafts").select("*").order("updated_at", { ascending: false }),
      supabase.from("platform_email_threads").select("*").order("last_message_at", { ascending: false }).limit(200),
      supabase.from("platform_email_messages").select("*").eq("direction", "inbound").order("received_at", { ascending: false }),
      supabase.from("platform_email_messages").select("*").eq("direction", "outbound").order("received_at", { ascending: true }),
    ]);
    if (msgs.error) toast.error("تعذّر تحميل الرسائل");
    const baseMsgs = (msgs.data as SupportMsg[]) || [];
    const threads = (pemT.data as any[]) || [];
    const inbound = (pemM.data as any[]) || [];
    const outbound = (pemOut.data as any[]) || [];
    const synthetic: SupportMsg[] = threads.map((t) => {
      const latest = inbound.find((m) => m.thread_id === t.id);
      const latestOut = outbound.slice().reverse().find((m) => m.thread_id === t.id);
      const hasInbound = !!latest;
      const display = [latest, latestOut]
        .filter(Boolean)
        .sort((a: any, b: any) => +new Date(b.received_at || b.created_at) - +new Date(a.received_at || a.created_at))[0];
      return {
        id: `pem:${t.id}`,
        sender_name: t.recipient_name || t.recipient_email,
        sender_email: t.recipient_email,
        sender_phone: null,
        organization_name: "بريد المنصة (Zoho)",
        subject: t.subject || "(بدون موضوع)",
        message: display?.body || "(لا يوجد محتوى متوفر)",
        category: "بريد المنصة",
        status: "open",
        is_read: !t.unread_for_owner,
        is_starred: false,
        is_spam: false,
        is_trashed: !!t.is_trashed,
        is_archived: false,
        labels: hasInbound ? ["zoho"] : ["zoho", "sent-only"],
        created_at: t.last_message_at || new Date().toISOString(),
        user_id: null,
      };
    });
    const merged = [...baseMsgs, ...synthetic].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );
    setMessages(merged);
    setAllReplies((reps.data as Reply[]) || []);
    setDrafts((drs.data as Draft[]) || []);
    setPemOutbound(outbound);
    setLoading(false);
  }, []);

  useEffect(() => { if (isOwner) loadAll(); }, [isOwner, loadAll]);

  // Realtime
  useEffect(() => {
    if (!isOwner) return;
    const ch = supabase
      .channel("inbox-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_replies" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_drafts" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_email_threads" }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_email_messages" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isOwner, loadAll]);

  // Folder filtering
  const folderMessages = useMemo(() => {
    let list = messages;
    if (folder === "trash") list = list.filter(m => m.is_trashed);
    else if (folder === "spam") list = list.filter(m => m.is_spam && !m.is_trashed);
    else if (folder === "archive") list = list.filter(m => m.is_archived && !m.is_trashed && !m.is_spam);
    else if (folder === "starred") list = list.filter(m => m.is_starred && !m.is_trashed);
    else if (folder === "sent") {
      const repliedIds = new Set(allReplies.filter(r => r.from_owner).map(r => r.message_id));
      const pemSentThreads = new Set(pemOutbound.map(o => `pem:${o.thread_id}`));
      list = list.filter(m => (repliedIds.has(m.id) || pemSentThreads.has(m.id)) && !m.is_trashed);
    }
    else if (folder === "inbox") list = list.filter(m => !m.is_trashed && !m.is_spam && !m.is_archived && !(m.labels?.includes("sent-only")));

    const s = search.trim().toLowerCase();
    if (s) list = list.filter(m =>
      m.sender_name.toLowerCase().includes(s) ||
      m.sender_email.toLowerCase().includes(s) ||
      m.subject.toLowerCase().includes(s) ||
      m.message.toLowerCase().includes(s)
    );
    return list;
  }, [messages, folder, search, allReplies, pemOutbound]);

  const counts = useMemo(() => ({
    inbox: messages.filter(m => !m.is_trashed && !m.is_spam && !m.is_archived && !m.is_read).length,
    starred: messages.filter(m => m.is_starred && !m.is_trashed).length,
    sent: new Set([
      ...allReplies.filter(r => r.from_owner).map(r => r.message_id),
      ...pemOutbound
        .map(o => messages.find(m => m.id === `pem:${o.thread_id}`))
        .filter((m): m is SupportMsg => !!m && !m.is_trashed)
        .map(m => m.id),
    ]).size,
    drafts: drafts.length,
    archive: messages.filter(m => m.is_archived && !m.is_trashed && !m.is_spam).length,
    spam: messages.filter(m => m.is_spam && !m.is_trashed).length,
    trash: messages.filter(m => m.is_trashed).length,
  }), [messages, allReplies, drafts, pemOutbound]);

  const selected = useMemo(() => messages.find(m => m.id === selectedId) || null, [messages, selectedId]);
  const selectedReplies = useMemo(() => {
    if (!selectedId) return [];
    if (selectedId.startsWith("pem:")) {
      const threadId = selectedId.slice(4);
      return pemOutbound
        .filter(o => o.thread_id === threadId)
        .map(o => ({
          id: o.id,
          message_id: selectedId,
          body: o.body || "",
          from_owner: true,
          created_at: o.received_at || o.created_at,
        })) as Reply[];
    }
    return allReplies.filter(r => r.message_id === selectedId);
  }, [allReplies, selectedId, pemOutbound]);

  const selectMessage = async (msg: SupportMsg) => {
    setSelectedId(msg.id);
    setSelectedDraftId(null);
    setComposing(false);
    setReplyText("");
    if (!msg.is_read) {
      if (msg.id.startsWith("pem:")) {
        await supabase.from("platform_email_threads")
          .update({ unread_for_owner: false })
          .eq("id", msg.id.slice(4));
      } else {
        await supabase.from("support_messages")
          .update({ is_read: true, status: msg.status === "new" ? "open" : msg.status })
          .eq("id", msg.id);
      }
    }
  };

  // Actions
  const patchMsg = async (id: string, patch: Partial<SupportMsg>) => {
    if (id.startsWith("pem:")) {
      if ("is_trashed" in patch) {
        await supabase.from("platform_email_threads").update({
          is_trashed: !!patch.is_trashed,
          trashed_at: patch.is_trashed ? new Date().toISOString() : null,
        } as any).eq("id", id.slice(4));
      }
      return;
    }
    await supabase.from("support_messages").update(patch).eq("id", id);
  };
  const toggleStar = (m: SupportMsg) => patchMsg(m.id, { is_starred: !m.is_starred });
  const toArchive  = (m: SupportMsg) => { patchMsg(m.id, { is_archived: true }); setSelectedId(null); toast.success("تم أرشفة الرسالة"); };
  const toSpam     = (m: SupportMsg) => { patchMsg(m.id, { is_spam: true, is_archived: false }); setSelectedId(null); toast.success("تم نقلها إلى غير الهام"); };
  const toTrash    = async (m: SupportMsg) => {
    if (m.id.startsWith("pem:")) {
      await patchMsg(m.id, { is_trashed: true });
      setSelectedId(null);
      toast.success("تم نقلها إلى المحذوفات");
      await loadAll();
      return;
    }
    patchMsg(m.id, { is_trashed: true });
    setSelectedId(null);
    toast.success("تم نقلها إلى المحذوفات");
  };
  const restore    = (m: SupportMsg) => { patchMsg(m.id, { is_trashed: false, is_spam: false, is_archived: false }); setSelectedId(null); toast.success("تم الاسترجاع"); };
  const purge      = async (m: SupportMsg) => {
    if (!confirm("حذف نهائي؟ لا يمكن التراجع.")) return;
    if (m.id.startsWith("pem:")) {
      const threadId = m.id.slice(4);
      await supabase.from("platform_email_messages").delete().eq("thread_id", threadId);
      await supabase.from("platform_email_threads").delete().eq("id", threadId);
    } else {
      await supabase.from("support_messages").delete().eq("id", m.id);
    }
    setSelectedId(null);
    toast.success("تم الحذف نهائياً");
    await loadAll();
  };

  // Reply via email + record
  const sendReply = async () => {
    if (!selectedId || !replyText.trim() || !selected) return;
    setSending(true);
    try {
      // Platform-mail (Zoho) thread: send via outbound email + record in platform_email_messages
      if (selectedId.startsWith("pem:")) {
        const threadId = selectedId.slice(4);
        const subject = selected.subject?.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`;
        const messageId = `${crypto.randomUUID()}@kfaah.org`;
        const { error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "platform-mail",
            recipientEmail: selected.sender_email,
            messageId,
            templateData: { subject, body: replyText.trim(), recipientName: selected.sender_name },
          },
        });
        if (sendErr) throw sendErr;
        await supabase.from("platform_email_messages").insert({
          thread_id: threadId,
          direction: "outbound",
          sender_email: "info@kfaah.org",
          recipient_email: selected.sender_email.toLowerCase(),
          subject,
          body: replyText.trim(),
          provider_message_id: messageId,
        });
        setReplyText("");
        toast.success("تم إرسال الرد عبر بريد المنصة");
        await loadAll();
        return;
      }

      const { error } = await supabase.from("support_replies").insert({
        message_id: selectedId,
        body: replyText.trim().slice(0, 5000),
        from_owner: true,
        author_user_id: user!.id,
      });
      if (error) throw error;

      // Determine the best email to send a copy to:
      // - If the message is linked to a registered account, use that account's email
      // - Otherwise fall back to the email from the contact form
      let targetEmail: string | null = selected.sender_email || null;
      if (selected.user_id) {
        try {
          const { data: accountEmail } = await supabase.rpc("get_user_account_email", {
            _user_id: selected.user_id,
          });
          if (accountEmail && typeof accountEmail === "string") {
            targetEmail = accountEmail;
          }
        } catch (e) {
          console.warn("account email lookup failed", e);
        }
      }

      if (targetEmail) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "support-reply",
              recipientEmail: targetEmail,
              templateData: {
                senderName: selected.sender_name,
                originalSubject: selected.subject,
                originalMessage: selected.message,
                replyBody: replyText.trim().slice(0, 5000),
              },
            },
          });
        } catch (e) { console.warn("email send failed", e); }
      }
      setReplyText("");
      toast.success(
        selected.user_id
          ? "تم إرسال الرد إلى حساب المستخدم وبريده المسجَّل"
          : "تم إرسال الرد إلى بريد المرسل"
      );
    } catch (err: any) {
      toast.error(err?.message || "تعذّر الإرسال");
    } finally { setSending(false); }
  };

  // Compose
  const openCompose = (preset?: { to?: string; subject?: string; body?: string; draftId?: string }) => {
    setComposing(true);
    setSelectedId(null);
    setComposeTo(preset?.to || "");
    setComposeSubject(preset?.subject || "");
    setComposeBody(preset?.body || "");
    setSelectedDraftId(preset?.draftId || null);
  };

  const saveDraft = async () => {
    if (!user) return;
    const payload = {
      author_user_id: user.id,
      to_email: composeTo || null,
      to_name: null,
      subject: composeSubject || null,
      body: composeBody || null,
    };
    if (selectedDraftId) {
      await supabase.from("support_drafts").update(payload).eq("id", selectedDraftId);
    } else {
      const { data } = await supabase.from("support_drafts").insert(payload).select("id").single();
      if (data?.id) setSelectedDraftId(data.id);
    }
    toast.success("تم حفظ المسودة");
  };

  const sendCompose = async () => {
    if (!composeTo.trim() || !composeBody.trim()) {
      toast.error("أدخل البريد المستلم ونص الرسالة");
      return;
    }
    setSending(true);
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "support-reply",
          recipientEmail: composeTo.trim(),
          templateData: {
            senderName: composeTo.trim(),
            originalSubject: composeSubject || "رسالة من كفاءة",
            originalMessage: "",
            replyBody: composeBody.trim(),
          },
        },
      });
      if (selectedDraftId) await supabase.from("support_drafts").delete().eq("id", selectedDraftId);
      toast.success("تم الإرسال");
      setComposing(false);
      setComposeTo(""); setComposeSubject(""); setComposeBody(""); setSelectedDraftId(null);
    } catch (e: any) {
      toast.error(e?.message || "تعذّر الإرسال");
    } finally { setSending(false); }
  };

  const deleteDraft = async (id: string) => {
    await supabase.from("support_drafts").delete().eq("id", id);
    if (selectedDraftId === id) { setSelectedDraftId(null); setComposing(false); }
    toast.success("تم حذف المسودة");
  };

  if (authLoading || isOwner === null) {
    return (
      <div dir="rtl" className="relative min-h-screen flex items-center justify-center text-slate-300"
           style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}>
        <SpaceScene />
        <div className="relative z-10">جارٍ التحميل...</div>
      </div>
    );
  }
  if (!isOwner) {
    return (
      <div dir="rtl" className="relative min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-hidden"
           style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}>
        <SpaceScene />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-2 text-white">صفحة محصورة</h1>
          <p className="text-slate-300 mb-4">هذه الصفحة متاحة فقط لمالك المنصة.</p>
          <button onClick={() => navigate("/")} className="text-cyan-300 font-bold">العودة للرئيسية</button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden"
         style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(220 60% 8%) 0%, hsl(225 70% 5%) 45%, hsl(230 80% 3%) 100%)" }}>
      <SpaceScene />
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white/[0.04] backdrop-blur-xl border-b border-white/10">
        <div className="max-w-[1500px] mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-black/40"
              style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
            >
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-extrabold text-white">بريد كفاءة</h1>
              <p className="text-[11px] text-slate-400">info@kfaah.org</p>
            </div>
          </div>

          <div className="flex-1 max-w-2xl mx-auto relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في البريد..."
              className="pr-10 bg-white/[0.06] border-white/15 text-white placeholder:text-slate-500 focus-visible:bg-white/[0.1] focus-visible:border-cyan-400/40"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={async () => {
                if (syncing) return;
                setSyncing(true);
                const t = toast.loading("جاري سحب الرسائل من البريد...");
                try {
                  const { data, error } = await supabase.functions.invoke("fetch-platform-email-replies", { body: {} });
                  if (error) throw error;
                  const s = (data as any)?.stats;
                  toast.success(s ? `تمت المزامنة — جديد: ${s.inserted ?? 0}` : "تمت المزامنة", { id: t });
                } catch (e: any) {
                  toast.error(e?.message || "تعذّرت مزامنة البريد", { id: t });
                } finally {
                  setSyncing(false);
                }
                await loadAll();
              }}
              disabled={syncing}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
              title="تحديث وسحب الرسائل من Zoho"
            >
              <RefreshCcw className={`w-4 h-4 text-slate-300 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => navigate("/")} className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10">
              للرئيسية <ArrowRight className="inline w-3 h-3 mr-1 rotate-180" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-[1500px] mx-auto p-3 grid grid-cols-1 lg:grid-cols-[230px_360px_1fr] gap-3 h-[calc(100vh-72px)]">
        {/* Right sidebar (folders) */}
        <aside className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/30 p-3 overflow-y-auto">
          <button
            onClick={() => openCompose()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg shadow-black/40 hover:-translate-y-0.5 transition-all mb-3"
            style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
          >
            <PenSquare className="w-4 h-4" />
            إنشاء رسالة
          </button>
          <nav className="space-y-1">
            {FOLDERS.map(f => {
              const Icon = f.icon;
              const active = folder === f.id;
              const count = counts[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => { setFolder(f.id); setSelectedId(null); setComposing(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                    active ? "bg-white/[0.12] text-white shadow-inner border border-white/20"
                           : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${active ? f.color : "text-slate-500"}`} />
                    {f.label}
                  </span>
                  {count > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      active ? "bg-white/20 text-white" : "bg-white/10 text-slate-300"
                    }`}>{count}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 px-2">تصنيفات</p>
            <div className="space-y-1 text-xs">
              {["استفسار عام", "مشكلة تقنية", "الاشتراك", "تدريب"].map(l => (
                <div key={l} className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:bg-white/5 rounded-lg cursor-default">
                  <span className="w-2 h-2 rounded-full bg-cyan-300" /> {l}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Middle: list */}
        <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/30 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              {(() => {
                const f = FOLDERS.find(x => x.id === folder)!;
                const Icon = f.icon;
                return <><Icon className={`w-4 h-4 ${f.color}`} />{f.label}</>;
              })()}
            </h2>
            <span className="text-[11px] text-slate-400">
              {folder === "drafts" ? `${drafts.length} مسودة` : `${folderMessages.length} رسالة`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">جارٍ التحميل...</div>
            ) : folder === "drafts" ? (
              drafts.length === 0 ? (
                <EmptyState icon={FileEdit} text="لا توجد مسودات" />
              ) : drafts.map(d => (
                <button
                  key={d.id}
                  onClick={() => openCompose({ to: d.to_email || "", subject: d.subject || "", body: d.body || "", draftId: d.id })}
                  className={`w-full text-right p-3 border-b border-white/5 hover:bg-white/[0.05] transition-colors ${
                    selectedDraftId === d.id ? "bg-cyan-400/10 border-r-4 border-r-cyan-400" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white truncate">إلى: {d.to_email || "(بدون مستلم)"}</span>
                    <span className="text-[10px] text-slate-500">{formatDate(d.updated_at)}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{d.subject || "(بدون موضوع)"}</div>
                  <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{d.body || "..."}</div>
                </button>
              ))
            ) : folderMessages.length === 0 ? (
              <EmptyState icon={Inbox} text="لا توجد رسائل" />
            ) : folderMessages.map(m => (
              <div
                key={m.id}
                onClick={() => selectMessage(m)}
                className={`group cursor-pointer p-3 border-b border-white/5 hover:bg-white/[0.05] transition-colors ${
                  selectedId === m.id ? "bg-cyan-400/10 border-r-4 border-r-cyan-400" : ""
                } ${!m.is_read ? "bg-amber-400/[0.04]" : ""}`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(m); }}
                    className="shrink-0 mt-0.5"
                    title="تمييز"
                  >
                    {m.is_starred
                      ? <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                      : <Star className="w-4 h-4 text-slate-500 hover:text-amber-300" />}
                  </button>
                  {!m.is_read && <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(252,211,77,0.6)]" />}
                  <span className={`flex-1 truncate text-sm ${m.is_read ? "font-semibold text-slate-300" : "font-extrabold text-white"}`}>
                    {m.sender_name}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">{formatDate(m.created_at)}</span>
                </div>
                <div className={`text-xs truncate mb-0.5 mr-6 ${m.is_read ? "text-slate-400" : "text-slate-100 font-bold"}`}>
                  {m.subject}
                </div>
                <div className="text-xs text-slate-500 line-clamp-1 mr-6">{m.message}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Detail / Compose */}
        <section className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl shadow-black/30 overflow-hidden flex flex-col">
          {composing ? (
            <ComposeView
              to={composeTo} setTo={setComposeTo}
              subject={composeSubject} setSubject={setComposeSubject}
              body={composeBody} setBody={setComposeBody}
              onClose={() => setComposing(false)}
              onSend={sendCompose}
              onSaveDraft={saveDraft}
              onDeleteDraft={selectedDraftId ? () => deleteDraft(selectedDraftId) : undefined}
              sending={sending}
            />
          ) : !selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Mail className="w-16 h-16 text-white/15 mb-4" />
              <p className="text-slate-300 mb-1 font-bold">اختر رسالة لعرضها</p>
              <p className="text-xs text-slate-500">أو ابدأ رسالة جديدة من الزر في الأعلى</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-1 flex-wrap">
                <ToolbarButton icon={Reply} label="رد" onClick={() => {}} />
                <ToolbarButton icon={Forward} label="تحويل" onClick={() => openCompose({
                  to: "", subject: `Fwd: ${selected.subject}`,
                  body: `\n\n--- رسالة محوّلة ---\nمن: ${selected.sender_name} <${selected.sender_email}>\nالموضوع: ${selected.subject}\n\n${selected.message}`
                })} />
                <Sep />
                <ToolbarButton icon={selected.is_starred ? StarOff : Star} label={selected.is_starred ? "إلغاء التمييز" : "تمييز"} onClick={() => toggleStar(selected)} />
                <ToolbarButton icon={Archive} label="أرشفة" onClick={() => toArchive(selected)} />
                <ToolbarButton icon={AlertOctagon} label="غير هام" onClick={() => toSpam(selected)} />
                <Sep />
                {(selected.is_trashed || selected.is_spam || selected.is_archived) && (
                  <ToolbarButton icon={RotateCcw} label="استرجاع" onClick={() => restore(selected)} />
                )}
                {selected.is_trashed ? (
                  <ToolbarButton icon={Trash} label="حذف نهائي" onClick={() => purge(selected)} danger />
                ) : (
                  <ToolbarButton icon={Trash2} label="حذف" onClick={() => toTrash(selected)} />
                )}
              </div>

              {/* Header */}
              <div className="p-5 border-b border-white/10">
                <h2 className="text-xl font-extrabold text-white mb-3">{selected.subject}</h2>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                       style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}>
                    {(selected.sender_name || "؟").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{selected.sender_name}</span>
                      <span className="text-xs text-slate-400" dir="ltr">&lt;{selected.sender_email}&gt;</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                      {selected.organization_name && (
                        <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{selected.organization_name}</span>
                      )}
                      {selected.sender_phone && (
                        <span className="inline-flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" />{selected.sender_phone}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateFull(selected.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversation */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <div className="bg-white/[0.06] backdrop-blur rounded-2xl p-4 border border-white/15">
                  <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                </div>
                {selectedReplies.map(r => (
                  <div key={r.id}
                    className={`rounded-2xl p-4 border backdrop-blur ${
                      r.from_owner ? "bg-emerald-400/10 border-emerald-300/30 mr-8" : "bg-white/[0.06] border-white/15 ml-8"
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-200">
                        {r.from_owner ? "ردّك (أُرسل بالبريد)" : selected.sender_name}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDateFull(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="p-4 border-t border-white/10 bg-white/[0.03]">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`اكتب ردك إلى ${selected.sender_name}...`}
                  rows={4} maxLength={5000}
                  className="resize-none mb-2 bg-white/[0.06] border-white/15 text-white placeholder:text-slate-500 focus-visible:bg-white/[0.1]"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400">
                    سيُرسَل الرد تلقائياً إلى بريد المُرسِل من info@kfaah.org
                  </p>
                  <button
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-bold text-sm shadow-lg shadow-black/40 disabled:opacity-50 hover:-translate-y-0.5 transition-all"
                    style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? "جارٍ الإرسال..." : "إرسال الرد"}
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

function ToolbarButton({ icon: Icon, label, onClick, danger }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
        danger ? "text-rose-300 hover:bg-rose-500/10" : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
function Sep() { return <span className="w-px h-5 bg-white/15 mx-1" />; }
function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="p-12 text-center">
      <Icon className="w-12 h-12 text-white/15 mx-auto mb-3" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

function ComposeView({ to, setTo, subject, setSubject, body, setBody, onClose, onSend, onSaveDraft, onDeleteDraft, sending }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-gradient-to-l from-cyan-400/10 to-transparent">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
          <PenSquare className="w-4 h-4 text-cyan-300" />
          رسالة جديدة
        </h2>
        <button onClick={onClose} className="text-xs font-bold text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10">
          إغلاق
        </button>
      </div>
      <div className="p-4 space-y-3 border-b border-white/10">
        <Field label="إلى">
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@example.com" dir="ltr" className="bg-transparent border-0 border-b border-white/15 rounded-none px-0 text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:border-cyan-300" />
        </Field>
        <Field label="الموضوع">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الرسالة" className="bg-transparent border-0 border-b border-white/15 rounded-none px-0 text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:border-cyan-300" />
        </Field>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <Textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="اكتب رسالتك هنا..."
          className="w-full h-full resize-none bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-0 text-sm leading-relaxed"
        />
      </div>
      <div className="p-3 border-t border-white/10 bg-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onSend}
            disabled={sending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-white font-bold text-sm shadow-lg shadow-black/40 disabled:opacity-50 hover:-translate-y-0.5 transition-all"
            style={{ background: `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${accentHsl}))` }}
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "جارٍ الإرسال..." : "إرسال"}
          </button>
          <button onClick={onSaveDraft} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white">
            <FileEdit className="w-3.5 h-3.5" /> حفظ كمسودة
          </button>
        </div>
        {onDeleteDraft && (
          <button onClick={onDeleteDraft} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-rose-300 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" /> حذف المسودة
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-bold text-slate-400 w-16 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso); const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "الآن";
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} س`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ي`;
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}
function formatDateFull(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}
