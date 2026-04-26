import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lightbulb, Sparkles, Loader2, Building2, Send, MessageSquare,
  CheckCircle2, XCircle, Trash2, Zap, FileText, BarChart3, Wrench,
  Wand2, Cog, TrendingUp, Database, Calendar, Filter, ChevronLeft,
} from "lucide-react";
import { useAdminAggregates, type DateRange, type OrgMetrics } from "@/hooks/useAdminAggregates";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportInnovationPpt } from "@/utils/exportInnovationPpt";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

type Category = "content" | "analytics" | "feature" | "ux" | "automation" | "growth" | "data";
type Status = "new" | "discussing" | "accepted" | "dismissed" | "implemented";

interface Suggestion {
  id: string;
  organization_id: string;
  title: string;
  summary: string;
  category: Category;
  area: string | null;
  priority: "high" | "medium" | "low";
  impact: string | null;
  effort: string | null;
  status: Status;
  data_basis: any;
  generated_at: string;
}

interface Message {
  id: string;
  suggestion_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const CATEGORY_META: Record<Category, { label: string; icon: any; tone: string }> = {
  content:    { label: "محتوى ومقالات",  icon: FileText,    tone: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  analytics:  { label: "تحليل ذكي",     icon: BarChart3,   tone: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
  feature:    { label: "ميزة جديدة",     icon: Wand2,       tone: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  ux:         { label: "تجربة استخدام",  icon: Wrench,      tone: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  automation: { label: "أتمتة وعمليات",   icon: Cog,         tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  growth:     { label: "نمو وشراكات",    icon: TrendingUp,  tone: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  data:       { label: "بيانات وحوكمة",  icon: Database,    tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
};

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-accent/10 text-accent border-accent/30",
};

const STATUS_TONE: Record<Status, string> = {
  new: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  discussing: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  accepted: "bg-accent/10 text-accent border-accent/30",
  dismissed: "bg-muted text-muted-foreground border-border",
  implemented: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

const STATUS_LABEL: Record<Status, string> = {
  new: "جديدة",
  discussing: "قيد النقاش",
  accepted: "مقبولة",
  dismissed: "مرفوضة",
  implemented: "مُنفذة",
};

export default function AdminInnovation() {
  const [range, setRange] = useState<DateRange>({ from: null, to: null, label: "منذ البداية" });
  const { metrics, loading: metricsLoading } = useAdminAggregates(range);
  const [orgId, setOrgId] = useState<string>("");
  // Embedded mode (inside org dashboard iframe) — lock to one org via ?org=slug
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isEmbedded = params.get("embedded") === "1";
  const lockedSlug = params.get("org") || "";
  const visibleMetrics = useMemo(
    () => (isEmbedded && lockedSlug ? metrics.filter((m) => m.org_slug === lockedSlug) : metrics),
    [metrics, isEmbedded, lockedSlug]
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"all" | Category>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [openSuggestion, setOpenSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => { if (!orgId && visibleMetrics.length > 0) setOrgId(visibleMetrics[0].org_id); }, [visibleMetrics, orgId]);

  const selected = useMemo(() => visibleMetrics.find((m) => m.org_id === orgId), [visibleMetrics, orgId]);

  const loadSuggestions = async (oid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("innovation_suggestions")
      .select("*")
      .eq("organization_id", oid)
      .order("generated_at", { ascending: false });
    if (error) toast.error(error.message);
    setSuggestions((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { if (orgId) loadSuggestions(orgId); }, [orgId]);

  const generate = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("innovation-suggestions", {
        body: { metrics: selected, period_label: range.label },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const items = (data?.suggestions || []) as any[];
      if (!items.length) { toast.error("لم تُنتج أفكارًا"); return; }
      const rows = items.map((s) => ({
        organization_id: selected.org_id,
        title: s.title,
        summary: s.summary,
        category: s.category || "feature",
        area: s.area || null,
        priority: s.priority || "medium",
        impact: s.impact || null,
        effort: s.effort || null,
        data_basis: typeof s.data_basis === "string" ? { note: s.data_basis } : s.data_basis,
        ai_model: data?.model || "google/gemini-3-flash-preview",
      }));
      const { error: insErr } = await supabase.from("innovation_suggestions").insert(rows);
      if (insErr) throw insErr;
      toast.success(`تم توليد ${rows.length} فكرة ابتكارية`);
      await loadSuggestions(selected.org_id);
    } catch (e: any) {
      toast.error(e.message || "تعذّر التوليد");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("innovation_suggestions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    if (openSuggestion?.id === id) setOpenSuggestion({ ...openSuggestion, status });
  };

  const removeSuggestion = async (id: string) => {
    if (!confirm("حذف هذه الفكرة نهائيًا؟")) return;
    const { error } = await supabase.from("innovation_suggestions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    if (openSuggestion?.id === id) setOpenSuggestion(null);
  };

  const filtered = useMemo(() => {
    return suggestions.filter((s) =>
      (filterCategory === "all" || s.category === filterCategory) &&
      (filterStatus === "all" || s.status === filterStatus)
    );
  }, [suggestions, filterCategory, filterStatus]);

  const stats = useMemo(() => ({
    total: suggestions.length,
    accepted: suggestions.filter((s) => s.status === "accepted" || s.status === "implemented").length,
    discussing: suggestions.filter((s) => s.status === "discussing").length,
    high: suggestions.filter((s) => s.priority === "high").length,
  }), [suggestions]);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        icon={<Lightbulb className="w-7 h-7" />}
        title={
          <span className="flex items-center gap-2">
            الابتكار والتحديث
            <Badge className="bg-white/20 text-white border-white/40">جديد</Badge>
          </span>
        }
        subtitle="يحلّل الذكاء الاصطناعي بياناتك ويقترح ابتكارات لم تخطر على بالك — تُناقشها معه ثم تقبلها أو ترفضها."
        actions={
          <Button onClick={generate} disabled={!selected || generating} className="gap-2 bg-white text-primary hover:bg-white/90 disabled:bg-white/60">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            توليد أفكار ابتكارية
          </Button>
        }
      />

      {/* Export accepted ideas */}
      {stats.accepted > 0 && selected && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              const accepted = suggestions.filter(
                (s) => s.status === "accepted" || s.status === "implemented"
              );
              exportInnovationPpt(accepted, selected.org_name);
              toast.success(`تم تصدير ${accepted.length} فكرة كخطة ابتكار`);
            }}
          >
            <Download className="w-4 h-4" />
            تصدير الأفكار المقبولة كخطة PowerPoint ({stats.accepted})
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card className="p-3 bg-card border-border" dir="rtl">
        <div className="flex flex-wrap items-center gap-3">
          {!isEmbedded && (
            <div className="flex items-center gap-2 flex-1 min-w-[260px]" dir="rtl">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <Select value={orgId} onValueChange={setOrgId} dir="rtl">
                <SelectTrigger className="flex-1 text-right"><SelectValue placeholder="اختر جمعية..." /></SelectTrigger>
                <SelectContent>
                  {visibleMetrics.map((m) => (<SelectItem key={m.org_id} value={m.org_id}>{m.org_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="إجمالي الأفكار" value={stats.total} icon={Lightbulb} tone="bg-amber-500/10 text-amber-600" />
        <StatTile label="عالية الأولوية" value={stats.high} icon={Zap} tone="bg-red-500/10 text-red-600" />
        <StatTile label="قيد النقاش" value={stats.discussing} icon={MessageSquare} tone="bg-violet-500/10 text-violet-600" />
        <StatTile label="مقبولة/مُنفذة" value={stats.accepted} icon={CheckCircle2} tone="bg-accent/10 text-accent" />
      </div>

      {/* Filter chips */}
      <Card className="p-5 bg-accent border-accent text-accent-foreground shadow-md" dir="rtl">
        <div className="flex flex-col gap-4">
          {/* Category row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-foreground/15 ring-1 ring-accent-foreground/30">
                <Filter className="h-4 w-4" />
              </div>
              <span className="text-base font-bold tracking-wide">التصنيف</span>
            </div>
            <ChevronLeft className="h-5 w-5 text-accent-foreground/60" />
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <FilterChip active={filterCategory === "all"} onClick={() => setFilterCategory("all")} label="الكل" />
              {(Object.keys(CATEGORY_META) as Category[]).map((c) => (
                <FilterChip key={c} active={filterCategory === c} onClick={() => setFilterCategory(c)} label={CATEGORY_META[c].label} />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-accent-foreground/20" />

          {/* Status row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-foreground/15 ring-1 ring-accent-foreground/30">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span className="text-base font-bold tracking-wide">الحالة</span>
            </div>
            <ChevronLeft className="h-5 w-5 text-accent-foreground/60" />
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <FilterChip active={filterStatus === "all"} onClick={() => setFilterStatus("all")} label="الكل" />
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <FilterChip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)} label={STATUS_LABEL[s]} />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-white/80"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card border-border">
          <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {suggestions.length === 0
              ? "لا توجد أفكار بعد. اضغط \"توليد أفكار ابتكارية\" ليحلل الذكاء بياناتك ويقترح ابتكارات."
              : "لا توجد أفكار تطابق الفلاتر."}
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SuggestionCard
              key={s.id} s={s}
              onOpen={() => setOpenSuggestion(s)}
              onStatus={(st) => updateStatus(s.id, st)}
              onDelete={() => removeSuggestion(s.id)}
            />
          ))}
        </div>
      )}

      {/* Discussion drawer */}
      {openSuggestion && (
        <DiscussionDrawer
          suggestion={openSuggestion}
          onClose={() => setOpenSuggestion(null)}
          onStatus={(st) => updateStatus(openSuggestion.id, st)}
        />
      )}

      {metricsLoading && <div className="text-center text-white/70 text-sm">جاري تحميل البيانات...</div>}
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tone }: any) {
  return (
    <Card className="p-4 bg-card border-border flex items-center gap-3">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border", tone)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function FilterChip({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-background text-foreground border-background shadow-sm"
          : "bg-transparent text-accent-foreground border-accent-foreground/40 hover:bg-accent-foreground/10"
      )}
    >{label}</button>
  );
}

function SuggestionCard({ s, onOpen, onStatus, onDelete }: {
  s: Suggestion; onOpen: () => void; onStatus: (st: Status) => void; onDelete: () => void;
}) {
  const meta = CATEGORY_META[s.category] || CATEGORY_META.feature;
  const Icon = meta.icon;
  const priorityLabel =
    s.priority === "high" ? "أولوية عالية" : s.priority === "medium" ? "متوسطة" : "منخفضة";
  const unifiedBadge =
    "bg-accent text-accent-foreground border border-accent/60 hover:bg-accent/90";
  return (
    <Card
      dir="rtl"
      className="bg-card border-border p-0 flex flex-col overflow-hidden hover:border-accent/40 hover:shadow-md transition-all"
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
            meta.tone
          )}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground leading-snug text-base mb-2 line-clamp-2">{s.title}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={unifiedBadge}>{meta.label}</Badge>
              <Badge variant="outline" className={unifiedBadge}>{priorityLabel}</Badge>
              <Badge variant="outline" className={unifiedBadge}>{STATUS_LABEL[s.status]}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-border" />

      {/* Description */}
      <div className="px-5 py-4 flex-1">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{s.summary}</p>

        {s.area && (
          <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-dashed border-border">
            <span className="font-semibold text-foreground">المنطقة المستهدفة: </span>{s.area}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-5 py-3 bg-muted/30 border-t border-border">
        <Button size="sm" onClick={onOpen} className="gap-1.5 flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
          <MessageSquare className="w-3.5 h-3.5" /> ناقش
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStatus("accepted")} title="قبول" className="gap-1 text-accent hover:text-accent/80">
          <CheckCircle2 className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => onStatus("dismissed")} title="رفض" className="gap-1 text-muted-foreground">
          <XCircle className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} title="حذف" className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

function DiscussionDrawer({ suggestion, onClose, onStatus }: {
  suggestion: Suggestion; onClose: () => void; onStatus: (st: Status) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const meta = CATEGORY_META[suggestion.category] || CATEGORY_META.feature;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("innovation_messages")
        .select("*").eq("suggestion_id", suggestion.id).order("created_at", { ascending: true });
      setMessages((data || []) as any);
      setLoading(false);
    })();
  }, [suggestion.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    // Optimistic user msg
    const userMsg: Message = {
      id: crypto.randomUUID(), suggestion_id: suggestion.id,
      role: "user", content: text, created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);

    try {
      // Save user message
      const { data: ins } = await supabase.from("innovation_messages")
        .insert({ suggestion_id: suggestion.id, role: "user", content: text })
        .select().single();
      if (ins) {
        setMessages((p) => p.map((m) => (m.id === userMsg.id ? (ins as any) : m)));
      }

      // Mark as discussing if new
      if (suggestion.status === "new") onStatus("discussing");

      // Call AI
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("innovation-chat", {
        body: { suggestion, history, user_message: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply: string = data?.reply || "—";
      const { data: aIns } = await supabase.from("innovation_messages")
        .insert({ suggestion_id: suggestion.id, role: "assistant", content: reply })
        .select().single();
      setMessages((p) => [...p, (aIns as any) || {
        id: crypto.randomUUID(), suggestion_id: suggestion.id,
        role: "assistant", content: reply, created_at: new Date().toISOString(),
      }]);
    } catch (e: any) {
      toast.error(e.message || "تعذّر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-background border-s border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-border bg-card">
          <div className="flex items-start gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border shrink-0", meta.tone)}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground">{suggestion.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.label} · {suggestion.area || "—"}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose}>إغلاق</Button>
          </div>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{suggestion.summary}</p>
          {suggestion.data_basis && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">الأساس البياني: </span>
              {typeof suggestion.data_basis === "string" ? suggestion.data_basis : (suggestion.data_basis.note || JSON.stringify(suggestion.data_basis))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3">
            <Button size="sm" variant="outline" className="gap-1.5 text-accent" onClick={() => onStatus("accepted")}>
              <CheckCircle2 className="w-3.5 h-3.5" /> قبول
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onStatus("implemented")}>
              <Sparkles className="w-3.5 h-3.5" /> مُنفذة
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground" onClick={() => onStatus("dismissed")}>
              <XCircle className="w-3.5 h-3.5" /> رفض
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-muted/20">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ابدأ النقاش — اسأل عن خطوات التنفيذ، البدائل، أو المخاطر.
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-accent text-accent-foreground rounded-bl-sm"
                    : "bg-card border border-border text-foreground rounded-br-sm"
                )}>{m.content}</div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-end">
              <div className="bg-card border border-border rounded-2xl rounded-br-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-border bg-card flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="اكتب رسالتك..."
            disabled={sending}
            className="flex-1"
          />
          <Button onClick={send} disabled={!input.trim() || sending} className="gap-1.5">
            <Send className="w-4 h-4" /> إرسال
          </Button>
        </div>
      </div>
    </div>
  );
}