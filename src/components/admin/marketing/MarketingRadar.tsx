import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radar, AlertTriangle, AlertCircle, Info, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Alert = {
  id: string;
  severity: "high" | "medium" | "low";
  type: string;
  title: string;
  description: string;
  recommendation: string;
  metric?: string | number;
  cta?: { label: string; action: string; payload?: any };
};

const SEV_STYLE: Record<string, string> = {
  high: "border-red-500/40 bg-red-500/5",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-blue-500/40 bg-blue-500/5",
};
const SEV_ICON: Record<string, any> = { high: AlertTriangle, medium: AlertCircle, low: Info };
const SEV_LABEL: Record<string, string> = { high: "عالي", medium: "متوسط", low: "للعلم" };

export default function MarketingRadar({ orgId }: { orgId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-radar", {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAlerts(data?.alerts ?? []);
      setGeneratedAt(data?.generated_at ?? null);
      toast.success(`تم رصد ${data?.alerts?.length ?? 0} فرصة/تنبيه`);
    } catch (e: any) {
      toast.error(`فشل المسح: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) scan(); }, [orgId]);

  const handleCta = async (a: Alert) => {
    if (a.cta?.action !== "create_campaign") return;
    const p = a.cta.payload ?? {};
    const { error } = await supabase.from("marketing_campaigns").insert({
      organization_id: orgId,
      name: p.name ?? a.title,
      goal: p.goal ?? a.recommendation,
      audience_segment: p.audience ?? "all",
      season_key: p.season_key ?? null,
      related_project: p.related_project ?? null,
      status: "draft",
      ai_metadata: { source: "radar", alert_id: a.id },
    });
    if (error) { toast.error("فشل الإنشاء"); return; }
    toast.success("تم إنشاء الحملة من التنبيه");
  };

  const grouped = { high: [] as Alert[], medium: [] as Alert[], low: [] as Alert[] };
  alerts.forEach((a) => grouped[a.severity]?.push(a));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-fuchsia-500/10 via-primary/5 to-transparent p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-fuchsia-500/15 p-3 text-fuchsia-600"><Radar className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-bold">راصد الفرص التسويقية</h3>
              <p className="text-sm text-muted-foreground">يفحص بياناتك ويكشف الفرص والمخاطر تلقائيًا · {generatedAt ? `آخر مسح: ${new Date(generatedAt).toLocaleString("ar-SA")}` : "اضغط لبدء الفحص"}</p>
            </div>
          </div>
          <Button onClick={scan} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "جاري المسح..." : "أعد المسح"}
          </Button>
        </div>
      </div>

      {alerts.length === 0 && !loading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>كل شيء على ما يرام · لا توجد تنبيهات حالياً</p>
        </CardContent></Card>
      ) : (
        (["high", "medium", "low"] as const).map((sev) =>
          grouped[sev].length === 0 ? null : (
            <div key={sev} className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={SEV_STYLE[sev]}>{SEV_LABEL[sev]} ({grouped[sev].length})</Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {grouped[sev].map((a) => {
                  const Icon = SEV_ICON[a.severity];
                  return (
                    <Card key={a.id} className={SEV_STYLE[a.severity]}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-2">
                          <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <CardTitle className="text-base">{a.title}</CardTitle>
                            <CardDescription className="mt-1 text-xs">{a.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p className="rounded-md bg-background/60 p-2 text-xs leading-relaxed">
                          <strong>التوصية:</strong> {a.recommendation}
                        </p>
                        {a.cta && (
                          <Button size="sm" variant="outline" className="gap-1 w-full" onClick={() => handleCta(a)}>
                            <Sparkles className="h-3 w-3" /> {a.cta.label}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}