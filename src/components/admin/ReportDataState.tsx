import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ReportDataState({ loading = false, error, retry }: { loading?: boolean; error: string | null; retry: () => void }) {
  return <div className="p-6 sm:p-8 text-center space-y-4" dir="rtl" role={error ? "alert" : "status"}>
    {loading ? <><Loader2 className="w-6 h-6 animate-spin mx-auto" /><p>جاري تحميل البيانات الكاملة…</p></>
      : <><p>{error}</p><Button onClick={retry}>إعادة المحاولة</Button></>}
  </div>;
}
