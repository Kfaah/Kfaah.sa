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
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: { 
    label: "قيد المراجعة", 
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    textColor: "text-amber-700 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: AlertCircle,
  },
  approved: { 
    label: "موافق عليه", 
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  rejected: { 
    label: "مرفوض", 
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
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
      <span className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.bgColor,
        config.textColor,
        config.borderColor
      )}>
        <StatusIcon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  return (
    <Card className="p-6 border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-sm">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">طلباتي</h2>
            <p className="text-xs text-muted-foreground">عرض وتتبع جميع طلباتك</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {requests.length} طلب
        </Badge>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">لا توجد طلبات</h3>
          <p className="text-sm text-muted-foreground mb-4">ابدأ بتقديم طلبك الأول</p>
          <Button onClick={onNewRequest} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            تقديم طلب
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request: any) => {
            const Icon = getRequestIcon(request.hr_request_types?.icon);
            const isExpanded = expandedRequests.has(request.id);
            const typeColor = request.hr_request_types?.color;

            return (
              <Collapsible 
                key={request.id} 
                open={isExpanded} 
                onOpenChange={() => toggleExpanded(request.id)}
              >
                <div className={cn(
                  "rounded-xl border-2 overflow-hidden transition-all",
                  isExpanded ? "border-primary/30 shadow-sm" : "border-border hover:border-muted-foreground/30"
                )}>
                  <div className="p-4 bg-card">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ 
                          background: typeColor 
                            ? `linear-gradient(135deg, ${typeColor}, ${typeColor}dd)` 
                            : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))'
                        }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-semibold text-foreground">
                            {request.hr_request_types?.name_ar}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded">
                            <FileText className="w-3 h-3" />
                            {request.request_number}
                          </span>
                          {request.start_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-primary" />
                              {format(new Date(request.start_date), "d MMM", { locale: ar })}
                              {request.end_date && request.end_date !== request.start_date && (
                                <> - {format(new Date(request.end_date), "d MMM", { locale: ar })}</>
                              )}
                            </span>
                          )}
                          {request.days_count && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-500" />
                              {request.days_count} يوم
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <CollapsibleTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-9 w-9 p-0">
                            <ChevronDown className={cn(
                              "w-4 h-4 transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )} />
                          </Button>
                        </CollapsibleTrigger>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onViewRequest(request)}
                          className="h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">عرض</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Timeline */}
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-3 border-t border-border bg-muted/20">
                      <WorkflowTimeline request={request} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </Card>
  );
}
