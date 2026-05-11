import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Loader2, Sparkles, Wand2, Palette, MessageSquare, CalendarClock, Wallet,
  ListChecks, FileText, Trash2, Save, Plus, Send, BarChart3, Award, Download,
} from "lucide-react";
import { toast } from "sonner";

type Campaign = any;
type Asset = { id: string; asset_type: string; title: string | null; body: string | null; metadata: any; created_at: string };
type Channel = { id: string; channel: string; scheduled_at: string | null; status: string; message: string | null; assigned_to: string | null; notes: string | null };

const PLATFORM_LABEL: Record<string, string> = {
  whatsapp: "واتساب", sms: "SMS", email: "إيميل", x: "X", instagram: "إنستغرام",
  snapchat: "سناب", tiktok: "تيك توك", youtube: "يوتيوب", google_ads: "Google Ads", meta_ads: "Meta Ads",
};
const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "draft", label: "مسودة" }, { value: "planned", label: "مخططة" },
  { value: "active", label: "نشطة" }, { value: "paused", label: "متوقفة" },
  { value: "completed", label: "مكتملة" }, { value: "archived", label: "مؤرشفة" },
];

export default function CampaignWorkspace({
  campaignId, open, onOpenChange, onChanged,
}: { campaignId: string | null; open: boolean; onOpenChange: (v: boolean) => void; onChanged: () => void }) {
  const [c, setC] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [actuals, setActuals] = useState<{ cost: number; donations: number }>({ cost: 0, donations: 0 });

  const load = async () => {
    if (!campaignId) return;
    setLoading(true);
    const [cRes, aRes, chRes, mRes] = await Promise.all([
      supabase.from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle(),
      supabase.from("marketing_campaign_assets").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
      supabase.from("marketing_campaign_channels").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: true }),
      supabase.from("marketing_campaign_metrics").select("cost, donations_amount").eq("campaign_id", campaignId),
    ]);
    setC(cRes.data);
    setAssets((aRes.data ?? []) as Asset[]);
    setChannels((chRes.data ?? []) as Channel[]);
    const cost = (mRes.data ?? []).reduce((s: number, r: any) => s + (Number(r.cost) || 0), 0);
    const dono = (mRes.data ?? []).reduce((s: number, r: any) => s + (Number(r.donations_amount) || 0), 0);
    setActuals({ cost, donations: dono });
    setLoading(false);
  };
  useEffect(() => { if (open && campaignId) load(); /* eslint-disable-next-line */ }, [open, campaignId]);

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" dir="rtl" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{c?.name ?? "حملة"}</SheetTitle>
          <SheetDescription>{c?.goal ?? ""}</SheetDescription>
        </SheetHeader>

        {loading || !c ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <Tabs defaultValue="brief" className="mt-4">
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="brief"><FileText className="h-4 w-4 ml-1" />Brief</TabsTrigger>
              <TabsTrigger value="content"><MessageSquare className="h-4 w-4 ml-1" />المحتوى</TabsTrigger>
              <TabsTrigger value="design"><Palette className="h-4 w-4 ml-1" />التصميم</TabsTrigger>
              <TabsTrigger value="channels"><CalendarClock className="h-4 w-4 ml-1" />القنوات</TabsTrigger>
              <TabsTrigger value="budget"><Wallet className="h-4 w-4 ml-1" />الميزانية</TabsTrigger>
              <TabsTrigger value="tasks"><ListChecks className="h-4 w-4 ml-1" />المهام</TabsTrigger>
              <TabsTrigger value="insights"><BarChart3 className="h-4 w-4 ml-1" />التقييم</TabsTrigger>
            </TabsList>

            <TabsContent value="brief" className="mt-4">
              <BriefTab c={c} onSaved={() => { load(); onChanged(); }} />
            </TabsContent>

            <TabsContent value="content" className="mt-4">
              <ContentTab c={c} assets={assets} reload={load} />
            </TabsContent>

            <TabsContent value="design" className="mt-4">
              <DesignTab c={c} assets={assets} reload={load} />
            </TabsContent>

            <TabsContent value="channels" className="mt-4">
              <ChannelsTab c={c} channels={channels} reload={load} />
            </TabsContent>

            <TabsContent value="budget" className="mt-4">
              <BudgetTab c={c} actuals={actuals} onChanged={() => { load(); onChanged(); }} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <TasksTab c={c} />
            </TabsContent>

            <TabsContent value="insights" className="mt-4">
              <InsightsTab c={c} actuals={actuals} onChanged={() => { load(); onChanged(); }} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ============ Brief tab ============ */
function BriefTab({ c, onSaved }: { c: Campaign; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: c.name ?? "", goal: c.goal ?? "", audience_segment: c.audience_segment ?? "",
    primary_message: c.primary_message ?? "", related_project: c.related_project ?? "",
    season_key: c.season_key ?? "", status: c.status ?? "draft",
    start_date: c.start_date ?? "", end_date: c.end_date ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("marketing_campaigns").update({
      ...form,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }).eq("id", c.id);
    setSaving(false);
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("تم حفظ تفاصيل الحملة");
    onSaved();
  };
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>اسم الحملة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label>الحالة</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>الهدف</Label><Textarea rows={2} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>الجمهور المستهدف</Label><Input value={form.audience_segment} onChange={(e) => setForm({ ...form, audience_segment: e.target.value })} /></div>
          <div><Label>المشروع المرتبط</Label><Input value={form.related_project} onChange={(e) => setForm({ ...form, related_project: e.target.value })} /></div>
        </div>
        <div><Label>الرسالة الرئيسية</Label><Textarea rows={3} value={form.primary_message} onChange={(e) => setForm({ ...form, primary_message: e.target.value })} /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>الموسم</Label><Input value={form.season_key} onChange={(e) => setForm({ ...form, season_key: e.target.value })} placeholder="ramadan / winter…" /></div>
          <div><Label>تاريخ البداية</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>تاريخ النهاية</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? "حفظ..." : "حفظ"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Insights tab ============ */
function InsightsTab({ c, actuals, onChanged }: { c: Campaign; actuals: { cost: number; donations: number }; onChanged: () => void }) {
  const [loading, setLoading] = useState(false);
  const [evalData, setEvalData] = useState<any | null>(c.ai_metadata?.last_evaluation ?? null);
  const [savePlaybook, setSavePlaybook] = useState(true);

  const evaluate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-evaluate-campaign", {
        body: { campaign_id: c.id, save_to_playbook: savePlaybook },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEvalData(data.evaluation);
      toast.success(savePlaybook ? "تم التقييم وحفظ الدروس في Playbook" : "تم التقييم");
      onChanged();
    } catch (e: any) { toast.error(e.message ?? "فشل"); } finally { setLoading(false); }
  };

  const exportReport = () => {
    if (!evalData) return;
    const lines: string[] = [];
    lines.push(`# تقرير ختامي — حملة: ${c.name}`);
    lines.push("");
    lines.push(`- التقدير العام: **${evalData.overall_grade}**`);
    lines.push(`- الميزانية المخططة: ${c.budget_planned ?? 0} ر.س`);
    lines.push(`- المصروف الفعلي: ${actuals.cost.toLocaleString()} ر.س`);
    lines.push(`- التبرعات الناتجة: ${actuals.donations.toLocaleString()} ر.س`);
    if (evalData.kpi_analysis) {
      lines.push(`- ROI: ${evalData.kpi_analysis.roi_pct ?? "—"}%`);
      lines.push(`- تكلفة كل تبرع: ${evalData.kpi_analysis.cost_per_donation ?? "—"} ر.س`);
      if (evalData.kpi_analysis.reach_vs_expected) lines.push(`- الوصول: ${evalData.kpi_analysis.reach_vs_expected}`);
      if (evalData.kpi_analysis.conversion_rate) lines.push(`- معدل التحويل: ${evalData.kpi_analysis.conversion_rate}`);
    }
    lines.push("");
    lines.push("## الملخص التنفيذي");
    lines.push(evalData.summary ?? "");
    if (evalData.strengths?.length) { lines.push("\n## نقاط القوة"); evalData.strengths.forEach((s: string) => lines.push(`- ${s}`)); }
    if (evalData.weaknesses?.length) { lines.push("\n## نقاط الضعف"); evalData.weaknesses.forEach((s: string) => lines.push(`- ${s}`)); }
    if (evalData.recommendations?.length) {
      lines.push("\n## التوصيات التنفيذية");
      evalData.recommendations.forEach((r: any) => lines.push(`- [${r.priority ?? "medium"}] ${r.action}${r.why ? ` — ${r.why}` : ""}`));
    }
    if (evalData.best_channel) lines.push(`\n**أفضل قناة:** ${evalData.best_channel}`);
    if (evalData.worst_channel) lines.push(`**أضعف قناة:** ${evalData.worst_channel}`);
    if (evalData.playbook_insights?.length) {
      lines.push("\n## دروس مستفادة (Playbook)");
      evalData.playbook_insights.forEach((p: any) => lines.push(`- [${p.insight_type}] ${p.finding}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `تقرير_${c.name}.md`; a.click(); URL.revokeObjectURL(url);
  };

  const gradeColor: Record<string, string> = {
    "ممتاز": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    "جيد جدًا": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    "جيد": "bg-primary/15 text-primary",
    "متوسط": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "ضعيف": "bg-destructive/15 text-destructive",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />تقييم الحملة بالذكاء الاصطناعي</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">يحلل النظام جميع قراءات الأداء، يقارن بالـKPIs المتوقعة، ويستخرج توصيات ودروسًا مستفادة.</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={savePlaybook} onChange={(e) => setSavePlaybook(e.target.checked)} />
              احفظ الدروس في ذاكرة الجمعية (Playbook)
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={evaluate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {evalData ? "أعد التقييم" : "ابدأ التقييم"}
            </Button>
            {evalData && <Button variant="outline" onClick={exportReport} className="gap-2"><Download className="h-4 w-4" />تنزيل التقرير</Button>}
          </div>
        </CardContent>
      </Card>

      {evalData && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Badge className={gradeColor[evalData.overall_grade] ?? "bg-muted"}>{evalData.overall_grade}</Badge>
              {evalData.best_channel && <Badge variant="outline">أفضل قناة: {evalData.best_channel}</Badge>}
              {evalData.worst_channel && <Badge variant="outline">أضعف قناة: {evalData.worst_channel}</Badge>}
            </div>
            <p className="text-sm leading-relaxed">{evalData.summary}</p>

            {evalData.kpi_analysis && (
              <div className="grid sm:grid-cols-4 gap-2 text-xs">
                {evalData.kpi_analysis.roi_pct != null && <div className="rounded border p-2"><div className="text-muted-foreground">ROI</div><div className="text-base font-bold">{evalData.kpi_analysis.roi_pct}%</div></div>}
                {evalData.kpi_analysis.cost_per_donation != null && <div className="rounded border p-2"><div className="text-muted-foreground">تكلفة/تبرع</div><div className="text-base font-bold">{evalData.kpi_analysis.cost_per_donation} ر.س</div></div>}
                {evalData.kpi_analysis.reach_vs_expected && <div className="rounded border p-2"><div className="text-muted-foreground">الوصول</div><div className="text-sm">{evalData.kpi_analysis.reach_vs_expected}</div></div>}
                {evalData.kpi_analysis.conversion_rate && <div className="rounded border p-2"><div className="text-muted-foreground">معدل التحويل</div><div className="text-sm">{evalData.kpi_analysis.conversion_rate}</div></div>}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {evalData.strengths?.length > 0 && (
                <div className="rounded border border-emerald-200 dark:border-emerald-900/50 p-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-2">نقاط القوة</h4>
                  <ul className="list-disc pr-5 text-sm space-y-1">{evalData.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {evalData.weaknesses?.length > 0 && (
                <div className="rounded border border-amber-200 dark:border-amber-900/50 p-3 bg-amber-50/50 dark:bg-amber-950/20">
                  <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">نقاط الضعف</h4>
                  <ul className="list-disc pr-5 text-sm space-y-1">{evalData.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>

            {evalData.recommendations?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">التوصيات التنفيذية</h4>
                <div className="space-y-2">
                  {evalData.recommendations.map((r: any, i: number) => (
                    <div key={i} className="rounded border p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={r.priority === "high" ? "destructive" : r.priority === "low" ? "outline" : "secondary"}>
                          {r.priority === "high" ? "عالية" : r.priority === "low" ? "منخفضة" : "متوسطة"}
                        </Badge>
                        <span className="text-sm font-medium">{r.action}</span>
                      </div>
                      {r.why && <p className="text-xs text-muted-foreground">{r.why}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {evalData.playbook_insights?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">دروس Playbook</h4>
                <div className="space-y-1">
                  {evalData.playbook_insights.map((p: any, i: number) => (
                    <div key={i} className="text-xs rounded bg-muted/50 px-2 py-1">
                      <Badge variant="outline" className="ml-2 text-[10px]">{p.insight_type}</Badge>
                      {p.finding}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ============ Content tab ============ */
function ContentTab({ c, assets, reload }: { c: Campaign; assets: Asset[]; reload: () => void }) {
  const [channel, setChannel] = useState("whatsapp");
  const [tone, setTone] = useState("ملهمة ومحترفة");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);

  const generate = async () => {
    setLoading(true); setVariants([]);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-generate-content", {
        body: { campaign_id: c.id, channel, tone, extra_instructions: extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVariants(data?.variants ?? []);
      toast.success(`تم توليد ${data?.variants?.length ?? 0} نسخ`);
    } catch (e: any) { toast.error(e.message ?? "خطأ"); } finally { setLoading(false); }
  };

  const save = async (v: any) => {
    const { error } = await supabase.from("marketing_campaign_assets").insert({
      campaign_id: c.id, organization_id: c.organization_id,
      asset_type: `text:${channel}`, title: v.label, body: v.body,
      metadata: { hashtags: v.hashtags ?? [], cta: v.cta ?? "", channel },
    });
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("تم الحفظ في الأصول");
    reload();
  };

  const del = async (id: string) => {
    await supabase.from("marketing_campaign_assets").delete().eq("id", id);
    reload();
  };

  const textAssets = assets.filter((a) => a.asset_type.startsWith("text:"));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4" />Studio المحتوى</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>القناة</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PLATFORM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>النبرة</Label><Input value={tone} onChange={(e) => setTone(e.target.value)} /></div>
            <div><Label>ملاحظات</Label><Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="مثال: ركّز على الأطفال" /></div>
          </div>
          <Button onClick={generate} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            ولّد 3 نسخ بالذكاء
          </Button>
        </CardContent>
      </Card>

      {variants.length > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          {variants.map((v, i) => (
            <Card key={i} className="border-primary/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm">{v.label}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{v.body}</p>
                {v.hashtags?.length > 0 && <p className="text-xs text-primary">{v.hashtags.join(" ")}</p>}
                {v.cta && <Badge variant="secondary">{v.cta}</Badge>}
                <Button size="sm" onClick={() => save(v)} className="gap-1 w-full"><Save className="h-3 w-3" />حفظ في الأصول</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-2">الأصول النصية المحفوظة ({textAssets.length})</h4>
        <div className="space-y-2">
          {textAssets.map((a) => (
            <Card key={a.id}><CardContent className="pt-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{PLATFORM_LABEL[a.asset_type.split(":")[1]] ?? a.asset_type}</Badge>
                  {a.title && <span className="text-xs text-muted-foreground">{a.title}</span>}
                </div>
                <p className="text-sm whitespace-pre-wrap">{a.body}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => del(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
          {textAssets.length === 0 && <p className="text-xs text-muted-foreground">لا توجد أصول محفوظة بعد.</p>}
        </div>
      </div>
    </div>
  );
}

/* ============ Design tab ============ */
function DesignTab({ c, assets, reload }: { c: Campaign; assets: Asset[]; reload: () => void }) {
  const [type, setType] = useState<"design" | "video" | "motion">("design");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<any | null>(null);

  const generate = async () => {
    setLoading(true); setBrief(null);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-design-brief", { body: { campaign_id: c.id, brief_type: type } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBrief(data?.brief ?? null);
    } catch (e: any) { toast.error(e.message ?? "خطأ"); } finally { setLoading(false); }
  };

  const save = async () => {
    if (!brief) return;
    const { error } = await supabase.from("marketing_campaign_assets").insert({
      campaign_id: c.id, organization_id: c.organization_id,
      asset_type: type === "design" ? "design_brief" : type === "video" ? "video_script" : "motion",
      title: brief.title, body: brief.concept, metadata: brief,
    });
    if (error) { toast.error("فشل الحفظ"); return; }
    toast.success("تم حفظ البريف");
    reload();
  };

  const briefs = assets.filter((a) => ["design_brief", "video_script", "motion"].includes(a.asset_type));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />بريف إبداعي</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="design">بريف تصميم</SelectItem>
                <SelectItem value="video">سكربت فيديو</SelectItem>
                <SelectItem value="motion">موشن جرافيك</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generate} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              ولّد البريف
            </Button>
          </div>
          {brief && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 space-y-2 text-sm">
                <h3 className="font-semibold text-base">{brief.title}</h3>
                <p><strong>الفكرة:</strong> {brief.concept}</p>
                {brief.visual_direction && <p><strong>التوجه البصري:</strong> {brief.visual_direction}</p>}
                {brief.color_palette?.length > 0 && (
                  <div className="flex items-center gap-2"><strong>الألوان:</strong>
                    {brief.color_palette.map((col: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs">
                        <span className="inline-block w-4 h-4 rounded border" style={{ background: col }} />{col}
                      </span>
                    ))}
                  </div>
                )}
                {brief.typography && <p><strong>الخطوط:</strong> {brief.typography}</p>}
                {brief.key_visuals?.length > 0 && <div><strong>عناصر بصرية:</strong><ul className="list-disc pr-5">{brief.key_visuals.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul></div>}
                {brief.copy_on_design && <p><strong>النصوص على التصميم:</strong> {brief.copy_on_design}</p>}
                {brief.deliverables?.length > 0 && <div><strong>المُسلمات:</strong><ul className="list-disc pr-5">{brief.deliverables.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul></div>}
                {brief.dont_do?.length > 0 && <div><strong>تجنّب:</strong><ul className="list-disc pr-5">{brief.dont_do.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul></div>}
                {brief.scenes?.length > 0 && (
                  <div><strong>المشاهد:</strong>
                    <div className="space-y-1 mt-1">
                      {brief.scenes.map((s: any, i: number) => (
                        <div key={i} className="rounded border p-2 text-xs">
                          <strong>{s.time}</strong> — {s.action}
                          {s.voiceover && <div className="text-muted-foreground">صوت: {s.voiceover}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button size="sm" onClick={save} className="gap-1"><Save className="h-3 w-3" />حفظ في الأصول</Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div>
        <h4 className="text-sm font-semibold mb-2">البريفات المحفوظة ({briefs.length})</h4>
        <div className="space-y-2">
          {briefs.map((b) => (
            <Card key={b.id}><CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge>{b.asset_type === "design_brief" ? "تصميم" : b.asset_type === "video_script" ? "فيديو" : "موشن"}</Badge>
                <span className="text-sm font-medium">{b.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">{b.body}</p>
            </CardContent></Card>
          ))}
          {briefs.length === 0 && <p className="text-xs text-muted-foreground">لا توجد بريفات بعد.</p>}
        </div>
      </div>
    </div>
  );
}

/* ============ Channels tab ============ */
function ChannelsTab({ c, channels, reload }: { c: Campaign; channels: Channel[]; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ channel: "whatsapp", scheduled_at: "", message: "", notes: "" });

  const add = async () => {
    if (!draft.channel) return;
    const { error } = await supabase.from("marketing_campaign_channels").insert({
      campaign_id: c.id, organization_id: c.organization_id,
      channel: draft.channel,
      scheduled_at: draft.scheduled_at ? new Date(draft.scheduled_at).toISOString() : null,
      message: draft.message || null, notes: draft.notes || null, status: "planned",
    });
    if (error) { toast.error("فشل"); return; }
    setAdding(false); setDraft({ channel: "whatsapp", scheduled_at: "", message: "", notes: "" });
    toast.success("تمت إضافة القناة"); reload();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("marketing_campaign_channels").update({ status, published_at: status === "published" ? new Date().toISOString() : null }).eq("id", id);
    reload();
  };
  const remove = async (id: string) => {
    await supabase.from("marketing_campaign_channels").delete().eq("id", id); reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold">جدول النشر ({channels.length})</h4>
        <Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1"><Plus className="h-4 w-4" />إضافة</Button>
      </div>
      {adding && (
        <Card><CardContent className="pt-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>القناة</Label>
              <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PLATFORM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>موعد النشر</Label><Input type="datetime-local" value={draft.scheduled_at} onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })} /></div>
          </div>
          <div><Label>الرسالة</Label><Textarea rows={3} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} /></div>
          <div><Label>ملاحظات</Label><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          <Button onClick={add} className="gap-1"><Save className="h-4 w-4" />احفظ</Button>
        </CardContent></Card>
      )}
      {channels.map((ch) => (
        <Card key={ch.id}><CardContent className="pt-4 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge>{PLATFORM_LABEL[ch.channel] ?? ch.channel}</Badge>
              <Badge variant="outline">{ch.status}</Badge>
              {ch.scheduled_at && <span className="text-xs text-muted-foreground">{new Date(ch.scheduled_at).toLocaleString("ar-SA")}</span>}
            </div>
            {ch.message && <p className="text-sm whitespace-pre-wrap">{ch.message}</p>}
            {ch.notes && <p className="text-xs text-muted-foreground mt-1">{ch.notes}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <Select value={ch.status} onValueChange={(v) => updateStatus(ch.id, v)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">مخطط</SelectItem>
                <SelectItem value="scheduled">مجدول</SelectItem>
                <SelectItem value="published">منشور</SelectItem>
                <SelectItem value="failed">فشل</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => remove(ch.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </CardContent></Card>
      ))}
      {channels.length === 0 && !adding && <p className="text-xs text-muted-foreground">لا توجد قنوات بعد.</p>}
    </div>
  );
}

/* ============ Budget tab ============ */
function BudgetTab({ c, actuals, onChanged }: { c: Campaign; actuals: { cost: number; donations: number }; onChanged: () => void }) {
  const planned = Number(c.budget_planned) || 0;
  const spent = actuals.cost;
  const donations = actuals.donations;
  const roi = spent > 0 ? ((donations - spent) / spent) * 100 : 0;
  const remaining = Math.max(0, planned - spent);
  const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;

  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState({ channel: "", cost: "", donations_amount: "", impressions: "", clicks: "", conversions: "", notes: "" });

  const save = async () => {
    const { error } = await supabase.from("marketing_campaign_metrics").insert({
      campaign_id: c.id, organization_id: c.organization_id,
      channel: entry.channel || null,
      cost: Number(entry.cost) || 0,
      donations_amount: Number(entry.donations_amount) || 0,
      impressions: Number(entry.impressions) || 0,
      clicks: Number(entry.clicks) || 0,
      conversions: Number(entry.conversions) || 0,
      notes: entry.notes || null,
    });
    if (error) { toast.error("فشل"); return; }
    setAdding(false); setEntry({ channel: "", cost: "", donations_amount: "", impressions: "", clicks: "", conversions: "", notes: "" });
    toast.success("تم تسجيل القراءة"); onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="مخططة" value={`${planned.toLocaleString()} ر.س`} />
        <Stat label="مصروفة" value={`${spent.toLocaleString()} ر.س`} />
        <Stat label="متبقية" value={`${remaining.toLocaleString()} ر.س`} />
        <Stat label="ROI" value={`${roi.toFixed(1)}%`} accent={roi >= 0} />
      </div>
      <div className="rounded-md bg-muted h-3 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">إجمالي التبرعات الناتجة: <strong>{donations.toLocaleString()} ر.س</strong></p>

      <div className="flex justify-between items-center pt-3">
        <h4 className="text-sm font-semibold">قراءات الأداء</h4>
        <Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1"><Plus className="h-4 w-4" />قراءة جديدة</Button>
      </div>
      {adding && (
        <Card><CardContent className="pt-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>القناة</Label>
              <Select value={entry.channel} onValueChange={(v) => setEntry({ ...entry, channel: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{Object.entries(PLATFORM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>التكلفة</Label><Input type="number" value={entry.cost} onChange={(e) => setEntry({ ...entry, cost: e.target.value })} /></div>
            <div><Label>التبرعات الناتجة</Label><Input type="number" value={entry.donations_amount} onChange={(e) => setEntry({ ...entry, donations_amount: e.target.value })} /></div>
            <div><Label>الظهور</Label><Input type="number" value={entry.impressions} onChange={(e) => setEntry({ ...entry, impressions: e.target.value })} /></div>
            <div><Label>النقرات</Label><Input type="number" value={entry.clicks} onChange={(e) => setEntry({ ...entry, clicks: e.target.value })} /></div>
            <div><Label>التحويلات</Label><Input type="number" value={entry.conversions} onChange={(e) => setEntry({ ...entry, conversions: e.target.value })} /></div>
          </div>
          <div><Label>ملاحظات</Label><Input value={entry.notes} onChange={(e) => setEntry({ ...entry, notes: e.target.value })} /></div>
          <Button onClick={save} className="gap-1"><Save className="h-4 w-4" />حفظ</Button>
        </CardContent></Card>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card><CardContent className="pt-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-emerald-600" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}

/* ============ Tasks tab ============ */
function TasksTab({ c }: { c: Campaign }) {
  const [items, setItems] = useState<string[]>([
    "إعداد قائمة المتبرعين المستهدفين",
    "تجهيز التصاميم والمحتوى",
    "جدولة المنشورات على القنوات",
    "متابعة الردود والتفاعل",
    "تسجيل النتائج اليومية",
  ]);
  const [newItem, setNewItem] = useState("");
  const [sending, setSending] = useState(false);

  const dispatch = async () => {
    if (items.length === 0) { toast.error("أضف خطوات أولًا"); return; }
    setSending(true);
    try {
      const suggestions = items.map((title, i) => ({
        source: `marketing_campaign:${c.id}`,
        title: `[${c.name}] ${title}`,
        description: `حملة تسويقية: ${c.name}\nالهدف: ${c.goal ?? "—"}\nخطوة: ${title}`,
        priority: "medium",
        category: "حملات تسويقية",
        due_in_days: i,
        estimated_minutes: 30,
        dedupe_key: `mcamp:${c.id}:${title}`.slice(0, 200),
        metadata: { campaign_id: c.id, campaign_name: c.name, step_index: i },
      }));
      const { data, error } = await supabase.functions.invoke("smart-task-dispatcher", {
        body: { organization_id: c.organization_id, suggestions },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`تم توزيع ${data?.scheduled ?? items.length} مهمة على الموظفين`);
    } catch (e: any) { toast.error(e.message ?? "فشل"); } finally { setSending(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Checklist تنفيذية</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded border p-2">
            <span className="flex-1 text-sm">{it}</span>
            <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="خطوة جديدة..." />
          <Button variant="outline" onClick={() => { if (newItem.trim()) { setItems([...items, newItem.trim()]); setNewItem(""); } }}>
            إضافة
          </Button>
        </div>
        <div className="pt-3 border-t">
          <Button onClick={dispatch} disabled={sending} className="gap-2 w-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            وزّع كمهام على الموظفين
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">سيُوزَّع تلقائيًا حسب طاقة كل موظف اليومية</p>
        </div>
      </CardContent>
    </Card>
  );
}