import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Send, Loader2, Bot, User as UserIcon, Trophy, Clock, CheckCircle2, Brain, Plus, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = {
  id: string;
  title: string;
  last_message_at: string;
};

const WELCOME_MSG: Msg = {
  role: "assistant",
  content:
    "مرحباً! 👋 أنا مساعدك الذكي. يمكنني مساعدتك في تنظيم مهامك، اقتراح أفكار لتحسين أدائك، أو شرح كيفية استخدام الذكاء الاصطناعي بذكاء في عملك. كيف يمكنني خدمتك اليوم؟",
};
type Period = "day" | "week" | "month" | "year";

function periodStart(p: Period): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "day") return d;
  if (p === "week") {
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (p === "month") {
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  d.setFullYear(d.getFullYear() - 1);
  return d;
}

const PERIOD_LABEL: Record<Period, string> = {
  day: "اليوم",
  week: "الأسبوع",
  month: "الشهر",
  year: "السنة",
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-assistant`;

export default function MyAssistant() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("is_demo_user", { _user_id: user.id });
      if (!cancelled) setIsDemo(!!data);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "مرحباً! 👋 أنا مساعدك الذكي. يمكنني مساعدتك في تنظيم مهامك، اقتراح أفكار لتحسين أدائك، أو شرح كيفية استخدام الذكاء الاصطناعي بذكاء في عملك. كيف يمكنني خدمتك اليوم؟",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [period, setPeriod] = useState<Period>("month");
  const [stats, setStats] = useState({
    completion: 0,
    quality: 0,
    timeEff: 0,
    aiUsage: 0,
    aiCount: 0,
    totalTasks: 0,
    completedTasks: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // ---------- Load metrics ----------
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      const since = periodStart(period).toISOString();

      const [tasksRes, qualityRes, usageRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,status,due_date,updated_at,estimated_time_minutes,actual_time_minutes")
          .eq("user_id", user.id)
          .gte("updated_at", since),
        supabase
          .from("task_quality_evaluations")
          .select("quality_score")
          .eq("user_id", user.id)
          .gte("evaluated_at", since),
        supabase
          .from("employee_ai_usage_logs")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", since),
      ]);

      if (cancelled) return;

      const tasks = (tasksRes.data ?? []) as Array<{
        status: string;
        due_date: string | null;
        updated_at: string;
        estimated_time_minutes: number | null;
        actual_time_minutes: number | null;
      }>;
      const total = tasks.length;
      const completed = tasks.filter((t) => t.status === "completed");
      const onTime = completed.filter((t) =>
        !t.due_date ? true : new Date(t.updated_at) <= new Date(t.due_date + "T23:59:59"),
      ).length;
      const completion = total === 0 ? 0 : Math.round((completed.length / total) * 100);

      // Quality (AI scores)
      const qs = (qualityRes.data ?? []).map((r: any) => Number(r.quality_score));
      const quality = qs.length === 0
        ? 0
        : Math.round(qs.reduce((a, b) => a + b, 0) / qs.length);

      // Time efficiency: avg(min(estimated/actual, 1)) * 100
      const timed = completed.filter(
        (t) => t.estimated_time_minutes && t.actual_time_minutes && t.actual_time_minutes > 0,
      );
      const timeEff = timed.length === 0
        ? (completed.length === 0 ? 0 : Math.round((onTime / Math.max(completed.length, 1)) * 100))
        : Math.round(
            (timed.reduce(
              (a, t) =>
                a +
                Math.min(
                  (t.estimated_time_minutes ?? 0) / (t.actual_time_minutes ?? 1),
                  1,
                ),
              0,
            ) /
              timed.length) *
              100,
          );

      // AI usage: count interactions; cap at "20 = 100%" baseline
      const aiCount = (usageRes.data ?? []).length;
      const aiUsage = Math.min(100, Math.round((aiCount / 20) * 100));

      setStats({
        completion,
        quality,
        timeEff,
        aiUsage,
        aiCount,
        totalTasks: total,
        completedTasks: completed.length,
      });
      setStatsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, period]);

  const overall = useMemo(
    () =>
      Math.round(
        (stats.completion + stats.quality + stats.timeEff + stats.aiUsage) / 4,
      ),
    [stats],
  );

  // ---------- Streaming chat ----------
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setStreaming(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && (last as any).__streaming) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [
          ...prev,
          { role: "assistant", content: assistantSoFar, __streaming: true } as any,
        ];
      });
    };

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          organizationId: currentOrg?.id ?? null,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("تم تجاوز حد الاستخدام، حاول بعد دقيقة.");
        else if (resp.status === 402) toast.error("نفذ رصيد الذكاء الاصطناعي.");
        else toast.error("المساعد الذكي غير متصل حالياً، يرجى المحاولة لاحقاً.");
        setStreaming(false);
        return;
      }
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      // Finalize streaming flag
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { role: m.role, content: m.content } : m,
        ),
      );
    } catch (e) {
      console.error(e);
      toast.error("المساعد الذكي غير متصل حالياً، يرجى المحاولة لاحقاً.");
    } finally {
      setStreaming(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="rounded-3xl bg-primary text-primary-foreground p-6 shadow-2xl shadow-primary/20 relative overflow-hidden">
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-foreground/15 ring-2 ring-primary-foreground/40 flex items-center justify-center backdrop-blur">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold">المساعد الذكي</h1>
                <p className="text-primary-foreground/85 mt-1">
                  مدعوم بـ Gemini & GPT — يحلّل أداءك ويدعمك في كل مهمة.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur rounded-xl px-3 py-1.5 ring-1 ring-primary-foreground/30">
              <span className="text-xs text-primary-foreground/85">الفترة</span>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-32 h-8 bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">اليوم</SelectItem>
                  <SelectItem value="week">آخر أسبوع</SelectItem>
                  <SelectItem value="month">آخر شهر</SelectItem>
                  <SelectItem value="year">آخر سنة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overall score */}
          <div className="relative mt-6 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-1 bg-white/15 ring-1 ring-white/30 rounded-2xl p-4 backdrop-blur flex flex-col items-center justify-center">
              <div className="text-xs text-white/85">التقييم العام · {PERIOD_LABEL[period]}</div>
              <div className="text-5xl font-extrabold leading-none mt-2">{statsLoading ? "—" : overall}</div>
              <div className="text-xs text-white/85 mt-1">من 100</div>
            </div>

            <MetricChip
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="إنجاز المهام"
              value={stats.completion}
              hint={`${stats.completedTasks}/${stats.totalTasks} مهمة`}
            />
            <MetricChip
              icon={<Trophy className="h-5 w-5" />}
              title="جودة الإنجاز"
              value={stats.quality}
              hint="تقييم AI لكل مهمة"
            />
            <MetricChip
              icon={<Clock className="h-5 w-5" />}
              title="كفاءة الوقت"
              value={stats.timeEff}
              hint="الفعلي مقابل المُقدّر"
            />
            <MetricChip
              icon={<Brain className="h-5 w-5" />}
              title="استخدام AI"
              value={stats.aiUsage}
              hint={`${stats.aiCount} استخدام`}
            />
          </div>
        </div>

        {/* Chat */}
        {isDemo ? (
          <Card className="border-2 border-dashed border-primary/30 shadow-xl">
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <Bot className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold">المساعد الذكي غير متاح في النسخة التجريبية</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                هذه الميزة معطّلة في وضع العرض التجريبي. للاستفادة من المساعد الذكي بالكامل، يُرجى استخدام حساب جمعيتكم الفعلي.
              </p>
            </CardContent>
          </Card>
        ) : (
        <Card className="border-2 border-primary/15 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              محادثة مع المساعد
            </CardTitle>
            <CardDescription>اطلب اقتراحات أداء، تنظيم مهام، أو طرق ذكية لاستخدام AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={scrollerRef}
              className="h-[420px] overflow-y-auto space-y-4 p-4 rounded-2xl bg-gradient-to-b from-muted/30 to-transparent"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    m.role === "user" ? "flex-row-reverse mr-auto" : "ml-auto",
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-full flex items-center justify-center",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-accent-foreground",
                    )}
                  >
                    {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border rounded-bl-sm prose prose-sm max-w-none dark:prose-invert",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> يكتب…
                </div>
              )}
            </div>

            <div className="mt-4 flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="اكتب سؤالك… (Enter للإرسال، Shift+Enter لسطر جديد)"
                className="min-h-[60px] max-h-[160px] resize-none"
                disabled={streaming}
              />
              <Button
                onClick={send}
                disabled={!input.trim() || streaming}
                className="h-[60px] w-[60px] p-0"
                aria-label="إرسال"
              >
                {streaming ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricChip({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="bg-white/15 ring-1 ring-white/30 rounded-2xl p-4 backdrop-blur">
      <div className="flex items-center justify-between text-white/90">
        <span className="text-xs font-medium">{title}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-white">{value}</span>
        <span className="text-xs text-white/80">/ 100</span>
      </div>
      <Progress value={value} className="mt-2 h-1.5 bg-white/20" />
      {hint && <div className="mt-1 text-[11px] text-white/75">{hint}</div>}
    </div>
  );
}