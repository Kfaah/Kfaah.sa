import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users2, ArrowRight, Check, X, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MembershipRow {
  id: string;
  user_id: string;
  organization_id: string;
  approval_status: "pending" | "approved" | "rejected";
  requested_at: string;
  approved_at: string | null;
  // Enriched
  display_name?: string;
  username?: string;
  contact_email?: string;
}

const statusMeta: Record<MembershipRow["approval_status"], { label: string; cls: string; icon: typeof Check }> = {
  pending:  { label: "قيد المراجعة", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  approved: { label: "موافَق عليه",  cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: ShieldCheck },
  rejected: { label: "مرفوض",        cls: "bg-rose-100 text-rose-800 border-rose-300", icon: X },
};

export default function MembersSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  const { user } = useAuth();
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("get_org_membership_requests", {
        _org_slug: slug ?? null,
      });
      if (error) throw error;
      setRows((data ?? []) as MembershipRow[]);
    } catch (e) {
      toast.error("تعذر تحميل قائمة الأعضاء");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateStatus = async (row: MembershipRow, status: "approved" | "rejected") => {
    if (!user?.id) return;
    setBusyId(row.id);
    try {
      const { error } = await (supabase as any).rpc("review_membership_request", {
        _membership_id: row.id,
        _status: status,
      });
      if (error) throw error;

      toast.success(status === "approved" ? "تمت الموافقة" : "تم الرفض");
      await loadData();
    } catch (e) {
      toast.error("تعذر تنفيذ الإجراء");
    } finally {
      setBusyId(null);
    }
  };

  const pending = rows.filter((r) => r.approval_status === "pending");
  const others  = rows.filter((r) => r.approval_status !== "pending");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<Users2 className="w-6 h-6" />}
            title="أعضاء الجمعية"
            subtitle="مراجعة طلبات الانضمام وإدارة عضويات المستخدمين"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              طلبات قيد المراجعة
              <Badge variant="secondary">{pending.length}</Badge>
            </h2>
            {loading ? (
              <p className="text-muted-foreground text-sm">جاري التحميل...</p>
            ) : pending.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد طلبات معلّقة حالياً.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((row) => (
                  <div key={row.id} className="flex items-center justify-between border rounded-lg p-3 bg-amber-50/50">
                    <div className="text-right">
                      <div className="font-semibold">{row.display_name || "مستخدم جديد"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.username ? `هوية: ${row.username} · ` : ""}
                        {row.contact_email && !row.contact_email.endsWith("@user.local") ? `بريد: ${row.contact_email} · ` : ""}
                        طلب الانضمام: {new Date(row.requested_at).toLocaleString("ar-SA")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateStatus(row, "approved")}
                        disabled={busyId === row.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="w-4 h-4 ml-1" /> موافقة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(row, "rejected")}
                        disabled={busyId === row.id}
                        className="text-rose-700 border-rose-300 hover:bg-rose-50"
                      >
                        <X className="w-4 h-4 ml-1" /> رفض
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              جميع الأعضاء
              <Badge variant="secondary">{others.length}</Badge>
            </h2>
            {others.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا يوجد أعضاء بعد.</p>
            ) : (
              <div className="space-y-2">
                {others.map((row) => {
                  const meta = statusMeta[row.approval_status];
                  const Icon = meta.icon;
                  return (
                    <div key={row.id} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="text-right">
                        <div className="font-medium">{row.display_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.username ? `هوية: ${row.username}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${meta.cls}`}>
                          <Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                        {row.approval_status === "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(row, "approved")} disabled={busyId === row.id}>
                            إعادة الموافقة
                          </Button>
                        )}
                        {row.approval_status === "approved" && (
                          <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => updateStatus(row, "rejected")} disabled={busyId === row.id}>
                            تعليق
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}