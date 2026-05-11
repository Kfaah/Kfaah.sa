import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Megaphone, Sparkles, Plus, Loader2, Calendar, Target, MessageCircle, TrendingUp, Wand2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import CampaignWorkspace from "./CampaignWorkspace";

type Campaign = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  audience_segment: string | null;
  platforms: any;
  budget_planned: number | null;
  start_date: string | null;
  end_date: string | null;
  related_project: string | null;
  ai_generated: boolean | null;
  primary_message: string | null;
  expected_kpis: any;
  ai_metadata: any;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", planned: "مُخططة", active: "نشطة", paused: "متوقفة", completed: "مكتملة", archived: "مؤرشفة",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  planned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-primary/15 text-primary",
  archived: "bg-muted text-muted-foreground",
};

const PLATFORM_LABEL: Record<string, string> = {
  whatsapp: "واتساب", sms: "SMS", email: "إيميل",
  x: "X (تويتر)", instagram: "إنستغرام", snapchat: "سناب",
  tiktok: "تيك توك", youtube: "يوتيوب",
  google_ads: "Google Ads", meta_ads: "Meta Ads",
};

export default function MarketingHub({ orgId }: { orgId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setCampaigns((data ?? []) as Campaign[]);
    setLoading(false);
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);

  const generateSuggestions = async () => {
    setGenerating(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-suggest-campaigns", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list = data?.campaigns ?? [];
      setSuggestions(list);
      toast.success(`تم اقتراح ${list.length} حملة`);
    } catch (e: any) {
      toast.error(`فشل التوليد: ${e.message ?? e}`);
    } finally {
      setGenerating(false);
    }
  };

  const acceptSuggestion = async (s: any) => {
    const startDate = new Date();
    const endDate = new Date(); endDate.setDate(endDate.getDate() + (s.duration_days ?? 30));
    const { error } = await supabase.from("marketing_campaigns").insert({
      organization_id: orgId,
      name: s.name,
      goal: s.goal,
      audience_segment: s.audience_segment,
      season_key: s.season_key ?? null,
      related_project: s.related_project ?? null,
      primary_message: s.primary_message,
      content_angles: s.content_angles ?? [],
      platforms: s.platforms ?? [],
      budget_planned: s.budget_planned ?? 0,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      expected_kpis: s.expected_kpis ?? {},
      status: "planned",
      ai_generated: true,
      ai_metadata: { drafts: s.drafts ?? {}, design_brief: s.design_brief ?? "", rationale: s.rationale ?? "" },
    });
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success(`تم إنشاء حملة: ${s.name}`);
    setSuggestions((prev) => prev.filter((x) => x !== s));
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-3 text-primary"><Megaphone className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-bold">مركز الحملات التسويقية</h2>
            <p className="text-sm text-muted-foreground">حملات احترافية مدعومة بالذكاء الاصطناعي · من الفكرة إلى القياس</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> حملة يدوية
          </Button>
          <Button onClick={generateSuggestions} disabled={generating} className="gap-2 shadow-md">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "جاري التحليل..." : "اقترح حملات بالذكاء"}
          </Button>
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">حملات مقترحة بالذكاء الاصطناعي</h3>
            <Badge variant="secondary">{suggestions.length}</Badge>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {suggestions.map((s, idx) => (
              <Card key={idx} className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <CardDescription className="mt-1">{s.goal}</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => acceptSuggestion(s)} className="gap-1">
                      <CheckCircle2 className="h-4 w-4" /> اعتمد
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">{s.audience_segment}</Badge>
                    {s.season_key && <Badge variant="outline">موسم: {s.season_key}</Badge>}
                    {s.budget_planned ? <Badge variant="outline">{s.budget_planned} ر.س</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(s.platforms ?? []).map((p: string) => (
                      <Badge key={p} className="bg-secondary text-secondary-foreground">{PLATFORM_LABEL[p] ?? p}</Badge>
                    ))}
                  </div>
                  <p className="rounded-md bg-background/60 p-2 leading-relaxed"><strong>الرسالة:</strong> {s.primary_message}</p>
                  {s.content_angles?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">زوايا المحتوى:</p>
                      <ul className="list-disc pr-5 text-xs">
                        {s.content_angles.map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                  {s.rationale && <p className="text-xs text-muted-foreground"><strong>لماذا هذه الحملة:</strong> {s.rationale}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          <h3 className="text-lg font-semibold">حملاتي ({campaigns.length})</h3>
        </div>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</p>
        ) : campaigns.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد حملات بعد. اضغط <strong>اقترح حملات بالذكاء</strong> لتوليد حملات احترافية من بياناتك.</p>
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {campaigns.map((c) => (
              <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setWorkspaceId(c.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={STATUS_COLOR[c.status] ?? "bg-muted"}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                        {c.ai_generated && <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />ذكاء</Badge>}
                        {c.audience_segment && <Badge variant="outline">{c.audience_segment}</Badge>}
                      </div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      {c.goal && <CardDescription className="mt-1 text-xs">{c.goal}</CardDescription>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setWorkspaceId(c.id); }}>
                      افتح
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {c.primary_message && <p className="text-xs leading-relaxed text-muted-foreground"><MessageCircle className="inline h-3 w-3 ml-1" />{c.primary_message}</p>}
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(c.platforms) ? c.platforms : []).map((p: string) => (
                      <Badge key={p} variant="outline" className="text-xs">{PLATFORM_LABEL[p] ?? p}</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                    {c.start_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{c.start_date} → {c.end_date ?? "—"}</span>}
                    {c.budget_planned ? <span>الميزانية: {c.budget_planned} ر.س</span> : null}
                    {c.expected_kpis?.donations_amount ? (
                      <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />هدف: {c.expected_kpis.donations_amount} ر.س</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} orgId={orgId} onCreated={load} />
      <CampaignWorkspace
        campaignId={workspaceId}
        open={!!workspaceId}
        onOpenChange={(v) => { if (!v) setWorkspaceId(null); }}
        onChanged={load}
      />
    </div>
  );
}

function CreateCampaignDialog({ open, onOpenChange, orgId, onCreated }:
  { open: boolean; onOpenChange: (v: boolean) => void; orgId: string; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", goal: "", audience_segment: "", primary_message: "", budget_planned: "", platforms: [] as string[],
  });

  const togglePlatform = (p: string) => {
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("اسم الحملة مطلوب"); return; }
    setSaving(true);
    const { error } = await supabase.from("marketing_campaigns").insert({
      organization_id: orgId,
      name: form.name,
      goal: form.goal || null,
      audience_segment: form.audience_segment || null,
      primary_message: form.primary_message || null,
      budget_planned: form.budget_planned ? Number(form.budget_planned) : 0,
      platforms: form.platforms,
      status: "draft",
    });
    setSaving(false);
    if (error) { toast.error("فشل الإنشاء"); return; }
    toast.success("تم إنشاء الحملة");
    setForm({ name: "", goal: "", audience_segment: "", primary_message: "", budget_planned: "", platforms: [] });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>إنشاء حملة يدوية</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم الحملة *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>الهدف</Label><Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="مثال: زيادة التبرعات الشهرية بنسبة 30%" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>الجمهور المستهدف</Label>
              <Select value={form.audience_segment} onValueChange={(v) => setForm({ ...form, audience_segment: v })}>
                <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="major_donors">كبار المتبرعين</SelectItem>
                  <SelectItem value="recurring">المتبرعون المتكررون</SelectItem>
                  <SelectItem value="lapsed">المنقطعون</SelectItem>
                  <SelectItem value="new">متبرعون جدد محتملون</SelectItem>
                  <SelectItem value="all">عامة الجمهور</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>الميزانية (ر.س)</Label><Input type="number" value={form.budget_planned} onChange={(e) => setForm({ ...form, budget_planned: e.target.value })} /></div>
          </div>
          <div><Label>الرسالة الرئيسية</Label><Textarea value={form.primary_message} onChange={(e) => setForm({ ...form, primary_message: e.target.value })} rows={3} /></div>
          <div>
            <Label>المنصات</Label>
            <div className="flex flex-wrap gap-2 pt-2">
              {Object.entries(PLATFORM_LABEL).map(([k, v]) => (
                <button key={k} type="button" onClick={() => togglePlatform(k)}
                  className={`px-3 py-1 text-xs rounded-full border ${form.platforms.includes(k) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "جاري الحفظ..." : "إنشاء"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}