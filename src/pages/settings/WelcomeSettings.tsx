import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, ArrowRight } from "lucide-react";
import { WelcomeContentManager } from "@/components/welcome/WelcomeContentManager";

export default function WelcomeSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<ImageIcon className="w-6 h-6" />}
            title="شاشة الترحيب"
            subtitle="إدارة خلفيات وعبارات شاشة الترحيب للموظفين"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <WelcomeContentManager />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}