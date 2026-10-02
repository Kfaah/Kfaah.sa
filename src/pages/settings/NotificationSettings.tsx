import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Bell, CheckCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { notificationPreferences } from "@/lib/notificationPreferences";
import type { Tables } from "@/integrations/supabase/types";

export default function NotificationSettings() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const base = slug ? `/${slug}` : "";
  const [preferences, setPreferences] = useState(() => notificationPreferences(user));
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Tables<"notifications">[]>([]);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  useEffect(() => { setPreferences(notificationPreferences(user)); }, [user]);
  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setError("");
    let query = supabase.from("notifications").select("*", { count: "exact" }).eq("user_id", user.id);
    let countQuery = supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
    if (currentOrg?.id) { query = query.eq("organization_id", currentOrg.id); countQuery = countQuery.eq("organization_id", currentOrg.id); }
    const [list, count] = await Promise.all([query.order("created_at", { ascending: false }).order("id").limit(limit), countQuery]);
    if (list.error || count.error) setError("تعذر تحميل الإشعارات. أعد المحاولة.");
    else { setRows(list.data || []); setTotal(list.count || 0); setUnread(count.count || 0); }
    setLoading(false);
  }, [user?.id, currentOrg?.id, limit]);
  useEffect(() => {
    void load();
    if (!user?.id) return;
    const channel = supabase.channel(`settings-notifications-${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => { void load(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, user?.id]);
  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { notification_preferences: preferences } });
      if (error) throw error;
      toast.success("تم حفظ تفضيلات الإشعارات");
    } catch { toast.error("تعذر حفظ التفضيلات. أعد المحاولة."); }
    finally { setSaving(false); }
  }
  async function markRead(id?: string) {
    if (!user?.id) return;
    setMarking(true);
    try {
      let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
      if (currentOrg?.id) query = query.eq("organization_id", currentOrg.id);
      if (id) query = query.eq("id", id); else query = query.eq("is_read", false);
      const { error } = await query;
      if (error) throw error;
      await load();
      toast.success(id ? "تم تحديد الإشعار كمقروء" : "تم تحديد جميع الإشعارات كمقروءة");
    } catch { toast.error("تعذر تحديث الإشعارات"); }
    finally { setMarking(false); }
  }
  return <DashboardLayout><div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
    <div className="flex items-center justify-between gap-3"><PageHeader icon={<Bell className="w-6 h-6" />} title="الإشعارات" subtitle="تفضيلات التنبيه الخاصة بحسابك وإشعارات الجمعية الحالية" /><Button asChild variant="ghost"><Link to={`${base}/settings`}><ArrowRight className="w-4 h-4 ml-2" />عودة</Link></Button></div>
    <Card><CardContent className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-6"><div><Label htmlFor="in-app-alerts">التنبيهات داخل المنصة</Label><p className="text-sm text-muted-foreground mt-1">عرض تنبيه عند وصول إشعار جديد أثناء استخدام المنصة. تبقى الإشعارات محفوظة عند إيقافه.</p></div><Switch id="in-app-alerts" checked={preferences.in_app_alerts} onCheckedChange={value => setPreferences(p => ({ ...p, in_app_alerts: value }))} disabled={saving} /></div>
      <div className="flex items-start justify-between gap-6"><div><Label htmlFor="unread-badge">عداد غير المقروء في القائمة</Label><p className="text-sm text-muted-foreground mt-1">إظهار عدد الإشعارات والرسائل غير المقروءة بجوار حسابك.</p></div><Switch id="unread-badge" checked={preferences.unread_badge} onCheckedChange={value => setPreferences(p => ({ ...p, unread_badge: value }))} disabled={saving} /></div>
      <Button onClick={save} disabled={saving || !user}><Save className="w-4 h-4 ml-2" />{saving ? "جارٍ الحفظ..." : "حفظ التفضيلات"}</Button>
    </CardContent></Card>
    <Card><CardContent className="p-6 space-y-4"><div className="flex items-center justify-between gap-3 flex-wrap"><h2 className="font-bold">إشعاراتي · {unread} غير مقروء</h2><Button variant="outline" onClick={() => markRead()} disabled={marking || unread === 0}><CheckCheck className="w-4 h-4 ml-2" />تحديد الكل كمقروء</Button></div>
      {error ? <div role="alert" className="text-destructive">{error}<Button variant="link" onClick={load}>إعادة المحاولة</Button></div> : !rows.length ? <p className="text-muted-foreground">{loading ? "جارٍ التحميل..." : "لا توجد إشعارات"}</p> : rows.map(row => <article key={row.id} className={`rounded-xl border p-4 space-y-2 ${row.is_read ? "" : "border-primary/40 bg-primary/5"}`}><div className="flex justify-between gap-3"><h3 className="font-medium">{row.title}</h3><time className="text-xs text-muted-foreground">{row.created_at ? new Date(row.created_at).toLocaleString("ar-SA") : ""}</time></div><p className="text-sm whitespace-pre-wrap">{row.message}</p><div className="flex gap-3">{row.related_task_id && <Button asChild size="sm" variant="outline"><Link to={`${base}/tasks/${row.related_task_id}`}>فتح المهمة</Link></Button>}{!row.is_read && <Button size="sm" variant="ghost" disabled={marking} onClick={() => markRead(row.id)}>تحديد كمقروء</Button>}</div></article>)}
      {rows.length < total && <Button variant="outline" disabled={loading} onClick={() => setLimit(n => n + 25)}>عرض المزيد ({rows.length} من {total})</Button>}
    </CardContent></Card>
  </div></DashboardLayout>;
}
