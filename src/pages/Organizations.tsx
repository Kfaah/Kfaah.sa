import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Building2, Plus, Edit3, Power, PowerOff, Mail, Phone, Calendar, Crown, Users, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization, type Organization } from "@/contexts/OrganizationContext";
import { toast } from "sonner";

type OrgWithCounts = Organization & { member_count?: number };

interface FormState {
  id?: string;
  name: string;
  slug: string;
  contact_email: string;
  contact_phone: string;
  subscription_tier: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  contact_email: "",
  contact_phone: "",
  subscription_tier: "standard",
  is_active: true,
};

export default function Organizations() {
  const { isSuperAdmin, loading: orgLoading, refresh, currentOrg } = useOrganization();
  const [orgs, setOrgs] = useState<OrgWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("تعذّر تحميل الجمعيات");
      setLoading(false);
      return;
    }

    // Fetch member counts in parallel
    const list = (data as Organization[]) || [];
    const counts = await Promise.all(
      list.map(async (o) => {
        const { count } = await supabase
          .from("user_organizations")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", o.id);
        return { ...o, member_count: count || 0 } as OrgWithCounts;
      })
    );
    setOrgs(counts);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchOrgs();
  }, [isSuperAdmin]);

  if (!orgLoading && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const openCreate = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (o: OrgWithCounts) => {
    setForm({
      id: o.id,
      name: o.name,
      slug: o.slug || "",
      contact_email: o.contact_email || "",
      contact_phone: o.contact_phone || "",
      subscription_tier: o.subscription_tier,
      is_active: o.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("اسم الجمعية مطلوب");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      subscription_tier: form.subscription_tier,
      is_active: form.is_active,
    };

    const { error } = form.id
      ? await supabase.from("organizations").update(payload).eq("id", form.id)
      : await supabase.from("organizations").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(error.message || "حدث خطأ أثناء الحفظ");
      return;
    }

    toast.success(form.id ? "تم تحديث الجمعية" : "تم إنشاء الجمعية");
    setDialogOpen(false);
    await fetchOrgs();
    await refresh();
  };

  const toggleActive = async (o: OrgWithCounts) => {
    const { error } = await supabase
      .from("organizations")
      .update({ is_active: !o.is_active })
      .eq("id", o.id);
    if (error) {
      toast.error("تعذّر تحديث الحالة");
      return;
    }
    toast.success(o.is_active ? "تم إيقاف الجمعية" : "تم تفعيل الجمعية");
    fetchOrgs();
    refresh();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--accent))] to-[hsl(var(--primary))] p-8 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
          <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-white">إدارة الجمعيات</h1>
                  <Crown className="w-6 h-6 text-amber-300" />
                </div>
                <p className="text-white/80 mt-1 text-sm">
                  لوحة المشرف العام · {orgs.length} جمعية مسجّلة
                </p>
              </div>
            </div>
            <Button onClick={openCreate} className="gap-2 bg-white text-primary hover:bg-white/90 shadow-lg">
              <Plus className="w-4 h-4" />
              إضافة جمعية
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="الجمعيات النشطة" value={orgs.filter((o) => o.is_active).length} icon={Sparkles} color="from-emerald-400 to-teal-500" />
          <StatCard label="إجمالي الأعضاء" value={orgs.reduce((s, o) => s + (o.member_count || 0), 0)} icon={Users} color="from-violet-500 to-purple-600" />
          <StatCard label="الجمعيات الموقوفة" value={orgs.filter((o) => !o.is_active).length} icon={PowerOff} color="from-rose-400 to-pink-500" />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
        ) : orgs.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد جمعيات بعد</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {orgs.map((o) => (
              <Card
                key={o.id}
                className={`p-5 relative overflow-hidden transition-all hover:shadow-xl ${
                  currentOrg?.id === o.id ? "ring-2 ring-primary" : ""
                } ${!o.is_active ? "opacity-70" : ""}`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />

                <div className="relative flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white border border-border flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden">
                    {(() => {
                      const isSawab = /sawab|صواب/i.test(`${o.slug ?? ""} ${o.name ?? ""}`);
                      const src = isSawab ? "/sawab-sidebar-logo-v10.png" : o.logo_url;
                      return src ? (
                        <img src={src} alt={o.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <Building2 className="w-7 h-7 text-muted-foreground" />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-foreground truncate">{o.name}</h3>
                      {currentOrg?.id === o.id && (
                        <Badge variant="default" className="text-[10px] py-0 px-1.5">الحالية</Badge>
                      )}
                    </div>
                    {o.slug && <p className="text-xs text-muted-foreground mt-0.5">@{o.slug}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={o.is_active ? "default" : "secondary"} className="text-[10px]">
                        {o.is_active ? "نشطة" : "موقوفة"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{o.subscription_tier}</Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    <span>{o.member_count} عضو</span>
                  </div>
                  {o.contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{o.contact_email}</span>
                    </div>
                  )}
                  {o.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      <span dir="ltr">{o.contact_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(o.created_at).toLocaleDateString("ar-SA")}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(o)}>
                    <Edit3 className="w-3.5 h-3.5" />
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant={o.is_active ? "secondary" : "default"}
                    className="gap-1.5"
                    onClick={() => toggleActive(o)}
                  >
                    {o.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    {o.is_active ? "إيقاف" : "تفعيل"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل الجمعية" : "إضافة جمعية جديدة"}</DialogTitle>
            <DialogDescription>
              {form.id ? "تحديث بيانات الجمعية" : "أضف جمعية جديدة لإدارتها في النظام"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>اسم الجمعية *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="جمعية ..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>المعرف (Slug)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.replace(/\s/g, "-").toLowerCase() })}
                  placeholder="example-org"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>الباقة</Label>
                <Select value={form.subscription_tier} onValueChange={(v) => setForm({ ...form, subscription_tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">قياسية</SelectItem>
                    <SelectItem value="premium">متقدمة</SelectItem>
                    <SelectItem value="enterprise">مؤسسية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="contact@example.com" dir="ltr" />
            </div>

            <div className="space-y-2">
              <Label>رقم الجوال</Label>
              <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+966 5x xxx xxxx" dir="ltr" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="cursor-pointer">حالة التفعيل</Label>
                <p className="text-xs text-muted-foreground mt-0.5">الجمعيات الموقوفة لا يمكن لأعضائها استخدام النظام</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : form.id ? "حفظ التغييرات" : "إنشاء الجمعية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card className="p-4 flex items-center gap-3 relative overflow-hidden">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </div>
    </Card>
  );
}
