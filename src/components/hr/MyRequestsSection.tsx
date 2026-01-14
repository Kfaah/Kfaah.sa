import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Calendar,
  Clock,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface MyRequestsSectionProps {
  requests: any[];
  isLoading: boolean;
  onNewRequest: () => void;
  onViewRequest: (request: any) => void;
  getRequestIcon: (iconName: string | null) => React.ComponentType<{ className?: string }>;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
  approved: { label: "موافق عليه", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

export function MyRequestsSection({
  requests,
  isLoading,
  onNewRequest,
  onViewRequest,
  getRequestIcon,
}: MyRequestsSectionProps) {
  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const StatusIcon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} gap-1`}>
        <StatusIcon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          سجل طلباتي
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
            <p className="text-muted-foreground mb-4">لم تقم بتقديم أي طلبات بعد</p>
            <Button onClick={onNewRequest} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              تقديم طلب جديد
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((request: any) => {
              const Icon = getRequestIcon(request.hr_request_types?.icon);
              return (
                <div
                  key={request.id}
                  className="flex items-center gap-4 p-4 rounded-xl border hover:shadow-md transition-shadow"
                >
                  <div
                    className={`w-12 h-12 rounded-xl ${
                      request.hr_request_types?.color || "bg-primary"
                    } flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {request.hr_request_types?.name_ar}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {request.request_number}
                      </span>
                      {request.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(request.start_date), "d MMM yyyy", { locale: ar })}
                          {request.end_date && request.end_date !== request.start_date && (
                            <> - {format(new Date(request.end_date), "d MMM yyyy", { locale: ar })}</>
                          )}
                        </span>
                      )}
                      {request.days_count && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {request.days_count} يوم
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewRequest(request)}
                    className="border-primary text-primary hover:bg-primary/10 flex-shrink-0"
                  >
                    <Eye className="w-4 h-4 ml-1" />
                    عرض
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
