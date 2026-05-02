import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
}

export default function ComingSoonSettings({ title, subtitle }: Props) {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<Sparkles className="w-6 h-6" />}
            title={title}
            subtitle={subtitle ?? "هذه الميزة قيد التطوير"}
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-bold text-lg mb-2">قريباً</h3>
            <p className="text-sm text-muted-foreground">
              نعمل على هذا القسم وسيكون متاحاً في تحديث قادم.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
