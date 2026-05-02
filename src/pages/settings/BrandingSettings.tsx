import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, ArrowRight, Save, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Branding = {
  id?: string;
  organization_id: string;
  site_name: string | null;
  site_tagline: string | null;
  display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
};

const empty = (orgId: string): Branding => ({
  organization_id: orgId,
  site_name: "",
  site_tagline: "",
  display_name: "",
  logo_url: "",
  favicon_url: "",
  primary_color: "#1f6f3f",
  secondary_color: "#0f4f2c",
  accent_color: "#f59e0b",
});

export default function BrandingSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [data, setData] = useState<Branding | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data: oid } = await supabase.rpc("get_user_organization_id", {
        _user_id: user.id,
      });
      if (!oid) return;
      setOrgId(oid as unknown as string);
      const { data: row } = await supabase
        .from("organization_branding")
        .select("*")
        .eq("organization_id", oid)
        .maybeSingle();
      setData(row ? (row as Branding) : empty(oid as unknown as string));
    };
    load();
  }, [user]);

  const save = async () => {
    if (!data || !orgId) return;
    setSaving(true);
    const payload = { ...data, organization_id: orgId };
    const { error } = await supabase
      .from("organization_branding")
      .upsert(payload, { onConflict: "organization_id" });
    setSaving(false);
    if (error) {
      toast.error("تعذّر الحفظ: " + error.message);
      return;
    }
    toast.success("تم حفظ الهوية");
  };

  const uploadLogo = async (file: File, field: "logo_url" | "favicon_url") => {
    if (!orgId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${orgId}/${field}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("branding-assets")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("فشل الرفع: " + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("branding-assets")
      .getPublicUrl(path);
    setData((d) => (d ? { ...d, [field]: urlData.publicUrl } : d));
    setUploading(false);
    toast.success("تم رفع الصورة");
  };

  const base = slug ? `/${slug}/settings` : "/settings";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<Palette className="w-6 h-6" />}
            title="هوية الجمعية"
            subtitle="اسم الموقع، الشعار، الألوان"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة للإعدادات
            </Link>
          </Button>
        </div>

        {data && (
          <>
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-lg">المعلومات الأساسية</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم الموقع</Label>
                    <Input
                      value={data.site_name ?? ""}
                      onChange={(e) =>
                        setData({ ...data, site_name: e.target.value })
                      }
                      placeholder="مثال: منصة جمعية الصواب"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الاسم المعروض للجمعية</Label>
                    <Input
                      value={data.display_name ?? ""}
                      onChange={(e) =>
                        setData({ ...data, display_name: e.target.value })
                      }
                      placeholder="جمعية الصواب الخيرية"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>الشعار النصي / الوصف</Label>
                    <Input
                      value={data.site_tagline ?? ""}
                      onChange={(e) =>
                        setData({ ...data, site_tagline: e.target.value })
                      }
                      placeholder="نظام إدارة الأداء والمهام"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-lg">الشعار والأيقونة</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>شعار الجمعية</Label>
                    {data.logo_url && (
                      <img
                        src={data.logo_url}
                        alt="logo"
                        className="h-20 object-contain rounded-lg border"
                      />
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Button asChild variant="outline" disabled={uploading}>
                        <span>
                          <Upload className="w-4 h-4 ml-2" />
                          {uploading ? "جاري الرفع..." : "رفع شعار"}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadLogo(f, "logo_url");
                        }}
                      />
                    </label>
                  </div>
                  <div className="space-y-3">
                    <Label>أيقونة المتصفح (Favicon)</Label>
                    {data.favicon_url && (
                      <img
                        src={data.favicon_url}
                        alt="favicon"
                        className="h-12 w-12 object-contain rounded-lg border"
                      />
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Button asChild variant="outline" disabled={uploading}>
                        <span>
                          <Upload className="w-4 h-4 ml-2" />
                          {uploading ? "جاري الرفع..." : "رفع أيقونة"}
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadLogo(f, "favicon_url");
                        }}
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-lg">الألوان</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      ["primary_color", "اللون الرئيسي"],
                      ["secondary_color", "اللون الثانوي"],
                      ["accent_color", "لون التمييز"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <Label>{label}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={data[key] ?? "#000000"}
                          onChange={(e) =>
                            setData({ ...data, [key]: e.target.value })
                          }
                          className="h-10 w-14 rounded cursor-pointer border"
                        />
                        <Input
                          value={data[key] ?? ""}
                          onChange={(e) =>
                            setData({ ...data, [key]: e.target.value })
                          }
                          className="font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  ملاحظة: الألوان تُحفظ كقيم HEX. سيتم تطبيقها تلقائياً على
                  العناصر الرئيسية للموقع لجمعيتك.
                </p>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button onClick={save} disabled={saving} size="lg">
                <Save className="w-4 h-4 ml-2" />
                {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}