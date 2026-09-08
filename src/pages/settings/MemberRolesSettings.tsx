import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCog, ArrowRight, Search, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type AppRole =
  | "super_admin"
  | "admin"
  | "moderator"
  | "hr_manager"
  | "finance_manager"
  | "accountant"
  | "time_editor"
  | "viewer"
  | "user";

const ROLE_OPTIONS: { key: AppRole; label: string; hint: string; superOnly?: boolean }[] = [
  { key: "super_admin", label: "مدير النظام", hint: "صلاحية كاملة على المنصة", superOnly: true },
  { key: "admin", label: "مدير الجمعية", hint: "إدارة كامل بيانات الجمعية", superOnly: true },
  { key: "moderator", label: "مدير قسم / تسويق", hint: "إدارة الفريق والحملات" },
  { key: "hr_manager", label: "مدير الموارد البشرية", hint: "الموظفون والتقييم" },
  { key: "finance_manager", label: "المدير المالي", hint: "المصروفات والتقارير المالية" },
  { key: "accountant", label: "محاسب", hint: "إدخال البيانات المالية" },
  { key: "time_editor", label: "محرر الأوقات", hint: "تعديل الوقت الفعلي للمهام" },
  { key: "viewer", label: "عرض فقط", hint: "لا يستطيع الإضافة أو التعديل" },
  { key: "user", label: "موظف", hint: "الصلاحيات الأساسية" },
];

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.key === r)?.label ?? r;

interface MemberRow {
  user_id: string;
  employee_id: string;
  full_name: string;
  username: string | null;
  job_role: string | null;
  organization_id: string | null;
  role_level: string | null;
  app_roles: AppRole[] | null;
}

type RpcClient = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message?: string } | null }>;
};
const rpc = supabase as unknown as RpcClient;

export default function MemberRolesSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  const { user } = useAuth();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: superFlag } = await rpc.rpc<boolean>("is_super_admin", { _user_id: user.id });
      setIsSuper(superFlag === true);

      let orgId: string | null = null;
      if (slug) {
        const { data: org } = await rpc.rpc<Array<{ id: string }>>("get_organization_by_slug", { _slug: slug });
        orgId = org?.[0]?.id ?? null;
      }

      const { data, error } = await rpc.rpc<MemberRow[]>("get_org_member_roles", { _org_id: orgId });
      if (error) throw error;
      setRows((data ?? []) as MemberRow[]);
    } catch {
      toast.error("تعذر تحميل قائمة الأعضاء");
    } finally {
      setLoading(false);
    }
  }, [user?.id, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (row: MemberRow, role: AppRole) => {
    setSavingId(row.user_id);
    try {
      const { error } = await rpc.rpc<void>("set_org_member_role", {
        _user_id: row.user_id,
        _role: role,
      });
      if (error) throw error;
      setRows((prev) =>
        prev.map((r) => (r.user_id === row.user_id ? { ...r, app_roles: [role] } : r))
      );
      toast.success(`${row.full_name}: ${roleLabel(role)}`);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "";
      if (msg.includes("insufficient_privileges")) {
        toast.error("هذا التغيير يحتاج صلاحية مدير النظام");
      } else if (msg.includes("demo_readonly")) {
        toast.error("الحساب التجريبي للعرض فقط");
      } else {
        toast.error("تعذر تغيير الصلاحية");
      }
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.full_name?.includes(t) ||
        (r.username ?? "").includes(t) ||
        (r.job_role ?? "").includes(t)
    );
  }, [rows, q]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <PageHeader
            icon={<UserCog className="w-6 h-6" />}
            title="صلاحيات الأعضاء"
            subtitle="عيّن لكل موظف صلاحيته: مدير نظام، مدير جمعية، مدير قسم أو موظف"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث باسم الموظف أو الوظيفة..."
                className="pr-10 text-right"
              />
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                لا يوجد أعضاء لديهم حسابات دخول في هذه الجمعية.
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((row) => {
                  const current = (row.app_roles?.[0] ?? "user") as AppRole;
                  const locked =
                    !isSuper && (current === "admin" || current === "super_admin");
                  return (
                    <div
                      key={row.user_id}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 flex-wrap"
                    >
                      <div className="text-right min-w-[180px]">
                        <div className="font-semibold flex items-center gap-2">
                          {row.full_name}
                          {(current === "admin" || current === "super_admin") && (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldCheck className="w-3 h-3" /> {roleLabel(current)}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.job_role || "—"}
                          {row.username ? ` · ${row.username}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {savingId === row.user_id && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        <Select
                          dir="rtl"
                          value={current}
                          disabled={locked || savingId === row.user_id}
                          onValueChange={(v) => changeRole(row, v as AppRole)}
                        >
                          <SelectTrigger className="w-[220px] text-right">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.filter((o) => isSuper || !o.superOnly).map((o) => (
                              <SelectItem key={o.key} value={o.key}>
                                <span className="font-medium">{o.label}</span>
                                <span className="text-xs text-muted-foreground"> — {o.hint}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {isSuper
            ? "بصفتك مدير النظام يمكنك منح أي صلاحية بما فيها مدير النظام ومدير الجمعية."
            : "منح صلاحية مدير النظام أو مدير الجمعية متاح لمدير النظام فقط، ولا يمكن تعديل صلاحية من يملكها."}
          {" "}تفاصيل ما يستطيع كل دور فعله تُضبط من صفحة «الأدوار والصلاحيات».
        </p>
      </div>
    </DashboardLayout>
  );
}
