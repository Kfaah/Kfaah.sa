import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { SourceLink } from "@/components/admin/SourceLink";

const LABELS = [
  "الموقع الإلكتروني",
  "المتجر",
  "X (تويتر)",
  "Instagram",
  "TikTok",
  "YouTube",
  "Snapchat",
];

const FILLED_URLS: Record<string, string> = {
  "الموقع الإلكتروني": "https://example.org",
  "المتجر": "https://store.example.org",
  "X (تويتر)": "https://x.com/example",
  "Instagram": "https://instagram.com/example",
  "TikTok": "https://tiktok.com/@example",
  "YouTube": "https://youtube.com/@example",
  "Snapchat": "https://snapchat.com/add/example",
};

function SourcesCard({
  title,
  resolver,
}: {
  title: string;
  resolver: (label: string) => string | null | undefined;
}) {
  return (
    <Card dir="rtl">
      <CardHeader className="text-right">
        <CardTitle className="flex items-center justify-start gap-2 text-right">
          <Building2 className="h-5 w-5 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-right text-sm" dir="rtl">
        {LABELS.map((label) => (
          <SourceLink key={label} label={label} url={resolver(label)} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function SourcesRtlTest() {
  return (
    <div className="container mx-auto space-y-6 p-6" dir="rtl">
      <header className="space-y-1 text-right">
        <h1 className="text-2xl font-bold">اختبار اتجاه RTL — بطاقة المصادر</h1>
        <p className="text-sm text-muted-foreground">
          عرض البطاقة بكل السيناريوهات للتحقق من ثبات اتجاه RTL: العنوان دائمًا
          على اليمين والأيقونة/الحالة دائمًا على اليسار.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SourcesCard title="كل الروابط موجودة" resolver={(l) => FILLED_URLS[l]} />
        <SourcesCard title="لا يوجد أي رابط" resolver={() => null} />
        <SourcesCard
          title="مزيج (روابط جزئية)"
          resolver={(l) =>
            ["الموقع الإلكتروني", "Instagram", "YouTube"].includes(l)
              ? FILLED_URLS[l]
              : null
          }
        />
        <SourcesCard
          title="روابط طويلة جدًا"
          resolver={(l) =>
            "https://example.org/very/long/path/that/keeps/going/and/going/" +
            encodeURIComponent(l)
          }
        />
      </div>
    </div>
  );
}