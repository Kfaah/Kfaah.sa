import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ArrowRight, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ROLES = [
  { key: "admin", label: "مدير الجمعية" },
  { key: "moderator", label: "مدير قسم / تسويق" },
  { key: "hr_manager", label: "مدير الموارد البشرية" },
  { key: "finance_manager", label: "المدير المالي" },
  { key: "accountant", label: "محاسب" },
  { key: "user", label: "موظف إداري" },
] as const;

const MODULES = [
  { key: "tasks", label: "المهام" },
  { key: "employees", label: "الموظفون" },
  { key: "operational_plans", label: "الخطط التشغيلية" },
  { key: "executive_plans", label: "الخطط التنفيذية" },
  { key: "performance", label: "تقييم الأداء" },
  { key: "accountability", label: "المساءلات" },
  { key: "reports", label: "التقارير" },
  { key: "intelligence", label: "التحليل الذكي" },
  { key: "settings", label: "الإعدادات" },
];

const ACTIONS = [
  { key: "can_view", label: "عرض" },
  { key: "can_create", label: "إنشاء" },
  { key: "can_edit", label: "تعديل" },
  { key: "can_delete", label: "حذف" },
] as const;

type PermRow = {
  id?: string;
  organization_id: string;
  role: (typeof ROLES)[number]["key"];
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

const cellKey = (role: string, mod: string) => `${role}::${mod}`;

export default function RolesPermissionsSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Record<string, PermRow>>({});
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
        .from("role_permissions")
        .select("*")
        .eq("organization_id", oid);
      const m: Record<string, PermRow> = {};
      // seed defaults
      ROLES.forEach((r) => {
        MODULES.forEach((mod) => {
          m[cellKey(r.key, mod.key)] = {
            organization_id: oid as unknown as string,
            role: r.key,
            module: mod.key,
            can_view: true,
            can_create: r.key === "admin" || r.key === "moderator",
            can_edit: r.key === "admin" || r.key === "moderator",
            can_delete: r.key === "admin",
          };
        });
      });
      (rows ?? []).forEach((row: any) => {
        m[cellKey(row.role, row.module)] = row;
      });
      setMatrix(m);
    };
    load();
  }, [user]);

  const toggle = (role: string, mod: string, action: typeof ACTIONS[number]["key"]) => {
    const key = cellKey(role, mod);
    setMatrix((prev) => ({
      ...prev,
      [key]: { ...prev[key], [action]: !prev[key][action] },
    }));
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const rows = Object.values(matrix).map((r) => ({
      organization_id: orgId,
      role: r.role,
      module: r.module,
      can_view: r.can_view,
      can_create: r.can_create,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
    }));
    const { error } = await supabase
      .from("role_permissions")
      .upsert(rows, { onConflict: "organization_id,role,module" });
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ: " + error.message);
      return;
    }
    toast.success("تم حفظ الصلاحيات");
  };

  const base = slug ? `/${slug}/settings` : "/settings";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<ShieldCheck className="w-6 h-6" />}
            title="الأدوار والصلاحيات"
            subtitle="حدّد بدقة ما يستطيع كل دور رؤيته أو تعديله"
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
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-right p-3 font-bold sticky right-0 bg-muted/50 min-w-[180px]">
                    الوحدة
                  </th>
                  {ROLES.map((r) => (
                    <th
                      key={r.key}
                      colSpan={ACTIONS.length}
                      className="p-3 font-bold text-center border-r"
                    >
                      {r.label}
                    </th>
                  ))}
                </tr>
                <tr className="bg-muted/30 border-b text-xs">
                  <th className="sticky right-0 bg-muted/30"></th>
                  {ROLES.map((r) =>
                    ACTIONS.map((a) => (
                      <th
                        key={`${r.key}-${a.key}`}
                        className="p-2 font-medium text-muted-foreground border-r"
                      >
                        {a.label}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod, i) => (
                  <tr
                    key={mod.key}
                    className={i % 2 ? "bg-muted/10" : ""}
                  >
                    <td className="p-3 font-semibold sticky right-0 bg-card border-l">
                      {mod.label}
                    </td>
                    {ROLES.map((r) =>
                      ACTIONS.map((a) => {
                        const cell = matrix[cellKey(r.key, mod.key)];
                        return (
                          <td
                            key={`${r.key}-${a.key}`}
                            className="p-2 text-center border-r"
                          >
                            <Checkbox
                              checked={cell?.[a.key] ?? false}
                              onCheckedChange={() =>
                                toggle(r.key, mod.key, a.key)
                              }
                            />
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          الصلاحيات تُطبَّق لكل جمعية على حدة. مدير النظام (super_admin) يملك
          صلاحية كاملة دائماً ولا يتأثر بهذه المصفوفة.
        </p>
      </div>
    </DashboardLayout>
  );
}