import { Card } from "@/components/ui/card";
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
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import { WorkflowTimeline } from "./WorkflowTimeline";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MyRequestsSectionProps {
  requests: any[];
  isLoading: boolean;
  onNewRequest: () => void;
  onViewRequest: (request: any) => void;
  getRequestIcon: (iconName: string | null) => React.ComponentType<{ className?: string }>;
}

const statusConfig: Record<string, { 
  label: string; 
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { 
    label: "قيد المراجعة", 
    variant: "secondary",
    icon: AlertCircle,
  },
  approved: { 
    label: "موافق عليه", 
    variant: "default",
    icon: CheckCircle2,
  },
  rejected: { 
    label: "مرفوض", 
    variant: "destructive",
    icon: XCircle,
  },
};

export function MyRequestsSection({
  requests,
  isLoading,
  onNewRequest,
  onViewRequest,
  getRequestIcon,
}: MyRequestsSectionProps) {
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());

  const toggleExpanded = (requestId: string) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const StatusIcon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1 text-xs">
        <StatusIcon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">طلباتي</h1>
          <p className="text-sm text-muted-foreground">عرض وتتبع جميع طلباتك</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {requests.length} طلب
        </Badge>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          </div>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">لا توجد طلبات</h3>
            <p className="text-sm text-muted-foreground mb-4">
              ابدأ بتقديم طلبك الأول
            </p>
            <Button onClick={onNewRequest} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              تقديم طلب
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request: any) => {
            const Icon = getRequestIcon(request.hr_request_types?.icon);
            const isExpanded = expandedRequests.has(request.id);

            return (
              <Collapsible 
                key={request.id} 
                open={isExpanded} 
                onOpenChange={() => toggleExpanded(request.id)}
              >
                <Card className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          request.hr_request_types?.color ? "" : "bg-primary/10"
                        )}
                        style={request.hr_request_types?.color ? { 
                          backgroundColor: `${request.hr_request_types.color}20`
                        } : undefined}
                      >
                        <Icon className={cn(
                          "w-5 h-5",
                          !request.hr_request_types?.color && "text-primary"
                        )} />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-foreground">
                            {request.hr_request_types?.name_ar}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {request.request_number}
                          </span>
                          {request.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(request.start_date), "d MMM", { locale: ar })}
                              {request.end_date && request.end_date !== request.start_date && (
                                <> - {format(new Date(request.end_date), "d MMM", { locale: ar })}</>
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
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CollapsibleTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <ChevronDown className={cn(
                              "w-4 h-4 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewRequest(request)}
                          className="h-8 gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">عرض</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Timeline */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/30">
                      <WorkflowTimeline request={request} />
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
