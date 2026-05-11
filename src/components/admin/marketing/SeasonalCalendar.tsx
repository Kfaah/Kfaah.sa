import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Moon, Flag, Sun, Snowflake } from "lucide-react";
import { toast } from "sonner";

type Event = {
  id: string;
  key: string;
  name_ar: string;
  description: string | null;
  category: string | null;
  hijri_month: number | null;
  gregorian_month: number | null;
  duration_days: number | null;
  marketing_tips: any;
};

const CAT_ICON: Record<string, any> = {
  religious: Moon, national: Flag, seasonal: Sun,
};
const CAT_LABEL: Record<string, string> = {
  religious: "ديني", national: "وطني", seasonal: "موسمي",
};
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const HIJRI_AR = ["محرم","صفر","ربيع الأول","ربيع الثاني","جمادى الأولى","جمادى الآخرة","رجب","شعبان","رمضان","شوال","ذو القعدة","ذو الحجة"];

export default function SeasonalCalendar({ orgId }: { orgId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketing_seasonal_events")
        .select("*")
        .eq("is_active", true);
      setEvents((data ?? []) as Event[]);
      setLoading(false);
    })();
  }, []);

  const createCampaignFromEvent = async (e: Event) => {
    const { error } = await supabase.from("marketing_campaigns").insert({
      organization_id: orgId,
      name: `حملة ${e.name_ar}`,
      goal: `استثمار موسم ${e.name_ar} لتعظيم التبرعات وتعميق الأثر`,
      season_key: e.key,
      status: "draft",
      audience_segment: "all",
      primary_message: e.description ?? "",
    });
    if (error) { toast.error("فشل الإنشاء"); return; }
    toast.success(`تم إنشاء حملة موسمية: ${e.name_ar}`);
  };

  if (loading) return <p className="text-center py-12 text-muted-foreground text-sm">جاري التحميل...</p>;

  // Group by category
  const grouped = events.reduce<Record<string, Event[]>>((acc, e) => {
    const cat = e.category ?? "other";
    (acc[cat] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-amber-500/10 via-primary/5 to-transparent p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/15 p-3 text-amber-600"><Calendar className="h-6 w-6" /></div>
          <div>
            <h3 className="text-lg font-bold">التقويم التسويقي الموسمي</h3>
            <p className="text-sm text-muted-foreground">المواسم الدينية والوطنية والموسمية في المملكة · مع نصائح تسويقية لكل موسم</p>
          </div>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, list]) => {
        const Icon = CAT_ICON[cat] ?? Snowflake;
        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">{CAT_LABEL[cat] ?? cat}</h4>
              <Badge variant="secondary">{list.length}</Badge>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {list.map((e) => (
                <Card key={e.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          {e.name_ar}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {e.hijri_month ? `هجري · ${HIJRI_AR[e.hijri_month - 1]}` : null}
                          {e.gregorian_month ? `ميلادي · ${MONTH_AR[e.gregorian_month - 1]}` : null}
                          {e.duration_days ? ` · ${e.duration_days} يوم` : null}
                        </CardDescription>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => createCampaignFromEvent(e)} className="gap-1">
                        <Sparkles className="h-3 w-3" /> أنشئ حملة
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {e.description && <p className="text-xs text-muted-foreground leading-relaxed">{e.description}</p>}
                    {Array.isArray(e.marketing_tips) && e.marketing_tips.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold mb-1">نصائح تسويقية:</p>
                        <ul className="list-disc pr-5 text-xs space-y-1 text-muted-foreground">
                          {e.marketing_tips.map((t: string, i: number) => <li key={i}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}