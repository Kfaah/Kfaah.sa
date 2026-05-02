import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileDown, ArrowRight } from "lucide-react";
import { exportGrantProposal } from "@/utils/exportGrantProposal";
import { toast } from "sonner";

export default function ExportsSettings() {
  const { slug } = useParams<{ slug?: string }>();
  const base = slug ? `/${slug}/settings` : "/settings";
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<FileDown className="w-6 h-6" />}
            title="التصدير والملفات"
            subtitle="ملفات تقديم المشروع للمانحين"
          />
          <Button asChild variant="ghost">
            <Link to={base}>
              <ArrowRight className="w-4 h-4 ml-2" /> عودة
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-bold text-lg">ملف تقديم المشروع</h3>
            <p className="text-sm text-muted-foreground">
              تصدير ملف تقديم المشروع للمانحين بصيغة Word.
            </p>
            <Button
              onClick={async () => {
                try {
                  await exportGrantProposal();
                  toast.success("تم تصدير الملف بنجاح");
                } catch {
                  toast.error("حدث خطأ أثناء التصدير");
                }
              }}
            >
              <FileDown className="w-4 h-4 ml-2" />
              تحميل ملف Word
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}