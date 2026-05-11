import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid, ArrowRight, Save, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DEFAULT_ITEMS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "operational-plans", label: "الخطط التشغيلية" },
  { key: "executive-plans", label: "الخطط التنفيذية" },
  { key: "tasks", label: "المهام" },
  { key: "my-accountability", label: "مساءلاتي" },
  { key: "my-performance", label: "أدائي" },
  { key: "performance", label: "تقييم الأداء" },
  { key: "intelligence", label: "التحليل الذكي" },
  { key: "reports", label: "التقارير" },
  { key: "innovation", label: "الابتكار والتجديد" },
];

type NavRow = {
  id?: string;
  organization_id: string;
  item_key: string;
  custom_label: string | null;
  display_order: number;
  is_visible: boolean;
};

export default function NavigationSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<NavRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: oid } = await supabase.rpc("get_user_organization_id", {
        _user_id: user.id,
      });
      if (!oid) return;
      setOrgId(oid as unknown as string);
      const { data: rows } = await supabase
        .from("navigation_customization")
        .select("*")
        .eq("organization_id", oid);
      const byKey = new Map(
        (rows ?? []).map((r: any) => [r.item_key, r as NavRow])
      );
      const merged: NavRow[] = DEFAULT_ITEMS.map((d, idx) => {
        const existing = byKey.get(d.key);
        return (
          existing ?? {
            organization_id: oid as unknown as string,
            item_key: d.key,
            custom_label: d.label,
            display_order: idx,
            is_visible: true,
          }
        );
      });
      merged.sort((a, b) => a.display_order - b.display_order);
      setItems(merged);
    };
    load();
  }, [user]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    next.forEach((it, i) => (it.display_order = i));
    setItems(next);
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const rows = items.map((it, i) => ({
      organization_id: orgId,
      item_key: it.item_key,
      custom_label: it.custom_label,
      display_order: i,
      is_visible: it.is_visible,
    }));
    const { error } = await supabase
      .from("navigation_customization")
      .upsert(rows, { onConflict: "organization_id,item_key" });
    setSaving(false);
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
      return;
    }
    toast.success("تم حفظ ترتيب القائمة");
  };

  const base = slug ? `/${slug}/settings` : "/settings";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<LayoutGrid className="w-6 h-6" />}
            title="الأيقونات والقوائم"
            subtitle="رتّب وأخفِ وأعد تسمية أيقونات الشريط الجانبي"
          />
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link to={base}>
                <ArrowRight className="w-4 h-4 ml-2" /> عودة
              </Link>
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 ml-2" />
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-2">
            {items.map((it, idx) => (
              <div
                key={it.item_key}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => move(idx, -1)}
                    className="p-1 hover:text-primary disabled:opacity-30"
                    disabled={idx === 0}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(idx, 1)}
                    className="p-1 hover:text-primary disabled:opacity-30"
                    disabled={idx === items.length - 1}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1">
                  <Input
                    value={it.custom_label ?? ""}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...it, custom_label: e.target.value };
                      setItems(next);
                    }}
                    placeholder="اسم الأيقونة"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    المعرّف: {it.item_key}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {it.is_visible ? "ظاهر" : "مخفي"}
                  </span>
                  <Switch
                    checked={it.is_visible}
                    onCheckedChange={(v) => {
                      const next = [...items];
                      next[idx] = { ...it, is_visible: v };
                      setItems(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}