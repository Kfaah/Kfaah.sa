import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Building2, Plus, Edit3, Power, PowerOff, Mail, Phone, Crown,
  Users, LogOut, ArrowLeftCircle, Link2, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization, type Organization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";
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

export default function AdminHub() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isSuperAdmin, loading: orgLoading, refresh, switchOrg } = useOrganization();
  const [orgs, setOrgs] = useState<OrgWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

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
    return <Navigate to="/app" replace />;
  }

  const openCreate = () => { setForm(emptyForm); setDialogOpen(true); };
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
    if (!form.name.trim()) { toast.error("اسم الجمعية مطلوب"); return; }
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
    if (error) { toast.error(error.message || "حدث خطأ أثناء الحفظ"); return; }
    toast.success(form.id ? "تم تحديث الجمعية" : "تم إنشاء الجمعية");
    setDialogOpen(false);
    await fetchOrgs();
    await refresh();
  };

  const toggleActive = async (o: OrgWithCounts) => {
    const { error } = await supabase
      .from("organizations").update({ is_active: !o.is_active }).eq("id", o.id);
    if (error) { toast.error("تعذّر تحديث الحالة"); return; }
    toast.success(o.is_active ? "تم إيقاف الجمعية" : "تم تفعيل الجمعية");
    fetchOrgs(); refresh();
  };

  const enterOrg = (o: OrgWithCounts) => {
    if (!o.is_active) { toast.error("هذه الجمعية موقوفة حالياً"); return; }
    switchOrg(o.id);
    toast.success(`الدخول إلى ${o.name}`);
    // وجّه إلى رابط الجمعية القصير إن وُجد، وإلا fallback إلى /app
    if (o.slug) {
      navigate(`/${o.slug}/app`);
    } else {
      navigate("/app");
    }
  };

  const copyOrgLink = async (slug: string) => {
    const url = `${window.location.origin}/j/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    toast.success("تم نسخ رابط الجمعية");
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Top bar */}
      <header className="relative z-10 border-b border-border/60 bg-white/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-foreground font-bold text-lg leading-tight">لوحة مدير النظام</h1>
              <p className="text-muted-foreground text-xs">نظام إدارة التسويق الإلكتروني للجمعيات</p>
            </div>
          </div>
          <Button onClick={handleSignOut} variant="ghost" size="sm" className="gap-2">
            <LogOut className="w-4 h-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">الجمعيات المسجّلة</h2>
            <p className="text-muted-foreground mt-1">
              اختر جمعية للدخول إلى نظامها · {orgs.length} جمعية
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> إضافة جمعية جديدة
          </Button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">جاري التحميل...</div>
        ) : orgs.length === 0 ? (
          <Card className="p-16 text-center bg-white border-border">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">لا توجد جمعيات بعد. ابدأ بإضافة أول جمعية.</p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> إضافة جمعية
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {orgs.map((o) => (
              <Card
                key={o.id}
                className={`group relative overflow-hidden bg-white border-0 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 ${
                  !o.is_active ? "opacity-60 grayscale" : ""
                }`}
              >
                {/* Decorative top */}
                <div className="h-1 bg-gradient-to-l from-accent to-primary" />

                <div className="p-6">
                  {/* Logo + name */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                      {o.logo_url ? (
                        <img src={o.logo_url} alt={o.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-foreground truncate">{o.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant={o.is_active ? "default" : "secondary"} className="text-[10px]">
                          {o.is_active ? "نشطة" : "موقوفة"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{o.subscription_tier}</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-4 min-h-[3.5rem]">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>{o.member_count} عضو</span>
                    </div>
                    {o.contact_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate" dir="ltr">{o.contact_email}</span>
                      </div>
                    )}
                    {o.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{o.contact_phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Slug link */}
                  {o.slug && (
                    <button
                      onClick={() => copyOrgLink(o.slug!)}
                      className="w-full mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs text-muted-foreground transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate flex-1 text-right" dir="ltr">/j/{o.slug}</span>
                      {copiedSlug === o.slug ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Primary action */}
                  <Button
                    onClick={() => enterOrg(o)}
                    disabled={!o.is_active}
                    className="w-full gap-2 bg-gradient-to-l from-primary to-accent hover:opacity-90 mb-2"
                  >
                    <ArrowLeftCircle className="w-4 h-4" />
                    الدخول إلى نظام الجمعية
                  </Button>

                  {/* Secondary actions */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(o)}>
                      <Edit3 className="w-3.5 h-3.5" /> تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant={o.is_active ? "secondary" : "default"}
                      className="gap-1.5"
                      onClick={() => toggleActive(o)}
                    >
                      {o.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

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
    </div>
  );
}
