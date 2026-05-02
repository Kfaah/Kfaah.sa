import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ArrowRight, Save, Eye, KeyRound, Loader2, Copy } from "lucide-react";
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
  const [viewerAccounts, setViewerAccounts] = useState<
    Array<{ id: string; full_name: string; username: string | null; organization_id: string | null; org_name?: string; org_logo?: string | null }>
  >([]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<
    Array<{ org: string; status: string; username?: string; password?: string; message?: string }>
  >([]);

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
      await loadViewers();
    };
    load();
  }, [user]);

  const loadViewers = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, username, organization_id, avatar_url")
      .eq("is_viewer_account", true)
      .order("full_name");
    if (!data) return;
    const orgIds = Array.from(new Set(data.map((d: any) => d.organization_id).filter(Boolean)));
    let orgMap: Record<string, { name: string; logo_url: string | null }> = {};
    if (orgIds.length) {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, logo_url")
        .in("id", orgIds);
      (orgs || []).forEach((o: any) => {
        orgMap[o.id] = { name: o.name, logo_url: o.logo_url };
      });
    }
    setViewerAccounts(
      data.map((d: any) => ({
        id: d.id,
        full_name: d.full_name,
        username: d.username,
        organization_id: d.organization_id,
        org_name: d.organization_id ? orgMap[d.organization_id]?.name : undefined,
        org_logo: d.organization_id ? orgMap[d.organization_id]?.logo_url : null,
      }))
    );
  };

  const generateViewers = async () => {
    setGenerating(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("create-org-viewer-accounts");
      if (error) {
        toast.error("فشل الإنشاء: " + error.message);
        return;
      }
      setResults(data?.results || []);
      const created = (data?.results || []).filter((r: any) => r.status === "created").length;
      const exists = (data?.results || []).filter((r: any) => r.status === "exists").length;
      toast.success(`تم: ${created} جديد · ${exists} موجود مسبقاً`);
      await loadViewers();
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ");
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

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

        {/* === حسابات عرض الجمعيات === */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">حسابات عرض الجمعيات</h3>
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    حساب واحد لكل جمعية باسمها وشعارها، صلاحياته العرض فقط (لا يستطيع الإضافة أو التعديل أو الحذف).
                    يستطيع الدخول لرؤية كل بيانات جمعيته.
                  </p>
                </div>
              </div>
              <Button onClick={generateViewers} disabled={generating}>
                {generating ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4 ml-2" />
                )}
                {generating ? "جاري الإنشاء..." : "إنشاء حسابات عرض لكل الجمعيات"}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="font-semibold text-sm">نتيجة آخر تشغيل:</p>
                <ul className="text-xs space-y-1.5">
                  {results.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 bg-background rounded px-3 py-2">
                      <span className="font-medium">{r.org}</span>
                      <span className="flex items-center gap-2">
                        {r.status === "created" && (
                          <>
                            <span className="text-green-600 font-semibold">✓ تم الإنشاء</span>
                            <code className="bg-muted px-2 py-0.5 rounded">{r.username}</code>
                            <code className="bg-muted px-2 py-0.5 rounded">{r.password}</code>
                          </>
                        )}
                        {r.status === "exists" && (
                          <span className="text-muted-foreground">موجود مسبقاً</span>
                        )}
                        {r.status === "error" && (
                          <span className="text-destructive">خطأ: {r.message}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  كلمة المرور الافتراضية موحّدة. يمكنك تغييرها لاحقاً من شاشة تعديل الموظف.
                </p>
              </div>
            )}

            {viewerAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm">الحسابات المُنشأة ({viewerAccounts.length}):</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {viewerAccounts.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0">
                        {v.org_logo ? (
                          <img src={v.org_logo} alt={v.full_name} className="w-full h-full object-contain" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{v.full_name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <code className="bg-muted px-1.5 py-0.5 rounded">{v.username}</code>
                          <button
                            onClick={() => v.username && copy(v.username)}
                            className="hover:text-primary"
                            title="نسخ اسم المستخدم"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <span className="text-[10px] bg-blue-500/10 text-blue-700 px-2 py-1 rounded-full font-semibold">
                        عرض فقط
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}