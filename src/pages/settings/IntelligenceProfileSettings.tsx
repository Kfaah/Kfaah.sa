import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, ArrowRight } from "lucide-react";
import { IntelligenceProfileManager } from "@/components/settings/IntelligenceProfileManager";

export default function IntelligenceProfileSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<Brain className="w-6 h-6" />}
            title="أسئلة الملف الذكي للموظف"
            subtitle="خصّص الأسئلة والخيارات التي يعبّيها الموظف عند تسجيله"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <IntelligenceProfileManager />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}