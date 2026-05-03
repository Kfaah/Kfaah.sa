import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageGuide } from "@/components/layout/PageGuide";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, Sparkles, TrendingUp, AlertTriangle, Target, Lightbulb, Users, Megaphone, RefreshCcw, CheckCircle2, MessageCircle, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Insight {
  id: string;
  insight_type: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
  recommended_actions: string[] | null;
  generated_at: string;
  is_pinned: boolean;
}
interface SmartTask {
  id: string;
  task_type: string;
  category: string;
  priority: string;
  title: string;
  description: string | null;
  suggested_message: string | null;
  suggested_channel: string | null;
  status: string;
  due_date: string | null;
  context: any;
  created_at: string;
}
interface Idea {
  id: string;
  idea_type: string;
  title: string;
  description: string;
  target_segment: string | null;
  channels: string[] | null;
  expected_impact: string | null;
  effort_level: string | null;
  content_draft: string | null;
  hashtags: string[] | null;
  status: string;
  created_at: string;
}
interface Run {
  id: string;
  status: string;
  insights_generated: number;
  tasks_generated: number;
  ideas_generated: number;
  events_detected: number;
  summary: string | null;
  started_at: string;
  completed_at: string | null;
}

const severityColor = (s: string) =>
  s === "critical" ? "bg-destructive text-destructive-foreground" :
  s === "high" ? "bg-orange-500 text-white" :
  s === "medium" ? "bg-yellow-500 text-white" :
  s === "low" ? "bg-blue-500 text-white" :
  "bg-muted text-muted-foreground";

const channelIcon = (c: string | null) =>
  c === "whatsapp" ? <MessageCircle className="w-4 h-4" /> :
  c === "call" ? <Phone className="w-4 h-4" /> :
  c === "email" ? <Mail className="w-4 h-4" /> :
  <MessageCircle className="w-4 h-4" />;

const Intelligence = () => {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [lastRun, setLastRun] = useState<Run | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const [iR, tR, dR, rR] = await Promise.all([
      supabase.from("donor_insights").select("*").eq("is_active", true).order("generated_at", { ascending: false }).limit(50),
      supabase.from("smart_tasks").select("*").eq("status", "pending").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(100),
      supabase.from("marketing_ideas").select("*").in("status", ["new", "approved"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("analysis_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setInsights((iR.data ?? []) as any);
    setTasks((tR.data ?? []) as any);
    setIdeas((dR.data ?? []) as any);
    setLastRun((rR.data as any) ?? null);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const runAnalysis = async () => {
    setRunning(true);
    toast.info("جاري التحليل الذكي للبيانات...");
    try {
      const { data, error } = await supabase.functions.invoke("run-intelligence", { body: { triggerSource: "manual" } });
      if (error) throw error;
      toast.success(`تم: ${data.insights} رؤية، ${data.tasks} مهمة، ${data.ideas} فكرة`);
      await loadAll();
    } catch (e: any) {
      toast.error(`فشل التحليل: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const completeTask = async (id: string) => {
    await supabase.from("smart_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
    setTasks((t) => t.filter((x) => x.id !== id));
    toast.success("تم إنجاز المهمة");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <PageHeader
          icon={<Brain className="w-6 h-6" />}
          title="التحليل الذكي"
          subtitle="رؤى ذكية، مهام ذكية، وأفكار إبداعية مولّدة من بيانات جمعيتك"
          actions={
            <Button size="lg" onClick={runAnalysis} disabled={running} className="gap-2 shadow-lg">
              <RefreshCcw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
              {running ? "جاري التحليل..." : "تشغيل تحليل ذكي الآن"}
            </Button>
          }
        />
        <PageGuide
          description="هذه الصفحة هي عقل النظام الذكي. تقوم بفحص جميع بيانات الجمعية (الموظفون، الخطط، المهام، التقارير، المساءلات) باستخدام نماذج الذكاء الاصطناعي، ثم تستخرج رؤى عميقة، تحدد نقاط القوة والضعف، وتقترح مهام وأفكار تطويرية قابلة للتنفيذ مباشرة."
          features={[
            "تحليل شامل لكافة بيانات الجمعية بالذكاء الاصطناعي",
            "استخراج رؤى عملية حول الأداء والمخاطر",
            "توليد مهام ذكية مرتبطة بالتوصيات",
            "اقتراح أفكار ابتكارية لتطوير الخدمات",
            "إمكانية إعادة التحليل في أي وقت",
          ]}
        />

        {/* آخر تشغيل */}
        {lastRun && (
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">آخر تحليل: {format(new Date(lastRun.started_at), "yyyy-MM-dd HH:mm")}</p>
                  <p className="text-xs text-muted-foreground">{lastRun.summary}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1"><Target className="w-3 h-3" />{lastRun.insights_generated} رؤية</Badge>
                <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" />{lastRun.tasks_generated} مهمة</Badge>
                <Badge variant="outline" className="gap-1"><Lightbulb className="w-3 h-3" />{lastRun.ideas_generated} فكرة</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="insights" className="gap-2 py-3"><TrendingUp className="w-4 h-4" />الرؤى ({insights.length})</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 py-3"><Target className="w-4 h-4" />المهام الذكية ({tasks.length})</TabsTrigger>
            <TabsTrigger value="ideas" className="gap-2 py-3"><Lightbulb className="w-4 h-4" />أفكار تسويقية ({ideas.length})</TabsTrigger>
          </TabsList>

          {/* الرؤى */}
          <TabsContent value="insights" className="space-y-3 mt-4">
            {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
             insights.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد رؤى بعد. شغّل التحليل لاكتشاف كنوز بياناتك.</p>
              </CardContent></Card>
             ) :
             insights.map((i) => (
              <Card key={i.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={severityColor(i.severity)}>{i.severity}</Badge>
                        <Badge variant="outline">{i.category}</Badge>
                        <Badge variant="secondary">{i.insight_type}</Badge>
                      </div>
                      <CardTitle className="text-lg">{i.title}</CardTitle>
                      <CardDescription className="mt-2 leading-relaxed">{i.summary}</CardDescription>
                    </div>
                    {i.severity === "critical" && <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
                  </div>
                </CardHeader>
                {i.recommended_actions && i.recommended_actions.length > 0 && (
                  <CardContent className="pt-0">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">إجراءات موصى بها:</p>
                    <ul className="space-y-1">
                      {i.recommended_actions.map((a, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span><span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* المهام الذكية */}
          <TabsContent value="tasks" className="space-y-3 mt-4">
            {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
             tasks.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد مهام ذكية. شغّل التحليل لتوليد مهام علاقات متبرعين.</p>
              </CardContent></Card>
             ) :
             tasks.map((t) => (
              <Card key={t.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={t.priority === "high" ? "bg-destructive text-destructive-foreground" : t.priority === "medium" ? "bg-yellow-500 text-white" : "bg-blue-500 text-white"}>{t.priority}</Badge>
                      <Badge variant="outline">{t.task_type}</Badge>
                      {t.suggested_channel && <Badge variant="secondary" className="gap-1">{channelIcon(t.suggested_channel)}{t.suggested_channel}</Badge>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => completeTask(t.id)}><CheckCircle2 className="w-4 h-4" /></Button>
                  </div>
                  <h3 className="font-semibold text-base mb-1">{t.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.description}</p>
                  {t.suggested_message && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />رسالة مقترحة بالذكاء:</p>
                      <p className="text-sm">{t.suggested_message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* أفكار تسويقية */}
          <TabsContent value="ideas" className="space-y-3 mt-4">
            {loading ? <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p> :
             ideas.length === 0 ? (
              <Card><CardContent className="p-12 text-center text-muted-foreground">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد أفكار. شغّل التحليل لاستلهام أفكار تسويقية إبداعية.</p>
              </CardContent></Card>
             ) :
             ideas.map((idea) => (
              <Card key={idea.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="default" className="gap-1"><Megaphone className="w-3 h-3" />{idea.idea_type}</Badge>
                        {idea.effort_level && <Badge variant="outline">جهد {idea.effort_level}</Badge>}
                        {idea.target_segment && <Badge variant="secondary">{idea.target_segment}</Badge>}
                      </div>
                      <CardTitle className="text-lg">{idea.title}</CardTitle>
                      <CardDescription className="mt-2">{idea.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {idea.content_draft && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-semibold mb-1">مسودة المحتوى:</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{idea.content_draft}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {idea.channels?.map((c) => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                    {idea.hashtags?.map((h) => <Badge key={h} variant="secondary" className="text-xs">#{h}</Badge>)}
                  </div>
                  {idea.expected_impact && <p className="text-xs text-muted-foreground"><strong>الأثر المتوقع:</strong> {idea.expected_impact}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Intelligence;
