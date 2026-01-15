import { Card, CardContent } from "@/components/ui/card";
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
  ChevronUp,
  Sparkles,
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
import { motion, AnimatePresence } from "framer-motion";
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
  glow: string;
}> = {
  pending: { 
    label: "قيد المراجعة", 
    bgColor: "bg-amber-500/10", 
    textColor: "text-amber-600",
    borderColor: "border-amber-500/30",
    icon: AlertCircle,
    glow: "shadow-amber-500/20"
  },
  approved: { 
    label: "موافق عليه", 
    bgColor: "bg-emerald-500/10", 
    textColor: "text-emerald-600",
    borderColor: "border-emerald-500/30",
    icon: CheckCircle2,
    glow: "shadow-emerald-500/20"
  },
  rejected: { 
    label: "مرفوض", 
    bgColor: "bg-red-500/10", 
    textColor: "text-red-600",
    borderColor: "border-red-500/30",
    icon: XCircle,
    glow: "shadow-red-500/20"
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
      <Badge 
        variant="outline" 
        className={cn(
          "gap-1.5 px-3 py-1 font-medium border",
          config.bgColor,
          config.textColor,
          config.borderColor
        )}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">سجل طلباتي</h2>
            <p className="text-muted-foreground">جميع طلباتك المقدمة</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            {requests.length} طلب
          </Badge>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-card to-muted/20">
          <CardContent className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <p className="text-muted-foreground">جاري تحميل الطلبات...</p>
            </div>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="border-0 shadow-xl bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-20 relative">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
            </div>
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-6 shadow-lg">
                <FileText className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">لا توجد طلبات</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-sm">
                لم تقم بتقديم أي طلبات بعد. ابدأ بتقديم طلبك الأول الآن!
              </p>
              <Button 
                onClick={onNewRequest} 
                className="gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                تقديم طلب جديد
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {requests.map((request: any, index: number) => {
              const Icon = getRequestIcon(request.hr_request_types?.icon);
              const isExpanded = expandedRequests.has(request.id);
              const statusConf = statusConfig[request.status] || statusConfig.pending;

              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(request.id)}>
                    <Card className={cn(
                      "border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden",
                      `${statusConf.glow} shadow-lg`
                    )}>
                      {/* الصف الرئيسي */}
                      <CardContent className="p-0">
                        <div className="flex items-center gap-4 p-5">
                          {/* Request Type Icon */}
                          <div
                            className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0",
                              request.hr_request_types?.color || "bg-primary"
                            )}
                          >
                            <Icon className="w-7 h-7 text-white" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-bold text-foreground text-lg">
                                {request.hr_request_types?.name_ar}
                              </h3>
                              {getStatusBadge(request.status)}
                            </div>
                            <div className="flex items-center gap-5 text-sm text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-lg">
                                <FileText className="w-3.5 h-3.5" />
                                {request.request_number}
                              </span>
                              {request.start_date && (
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-primary" />
                                  {format(new Date(request.start_date), "d MMM yyyy", { locale: ar })}
                                  {request.end_date && request.end_date !== request.start_date && (
                                    <> - {format(new Date(request.end_date), "d MMM yyyy", { locale: ar })}</>
                                  )}
                                </span>
                              )}
                              {request.days_count && (
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-accent" />
                                  {request.days_count} يوم
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <CollapsibleTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-foreground gap-1"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                                <span className="text-xs">سير المعاملة</span>
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              size="sm"
                              onClick={() => onViewRequest(request)}
                              className="bg-gradient-to-r from-primary to-accent text-white gap-1.5 rounded-xl px-4 shadow-md hover:shadow-lg transition-all"
                            >
                              <Eye className="w-4 h-4" />
                              عرض
                            </Button>
                          </div>
                        </div>

                        {/* مسار سير المعاملة */}
                        <CollapsibleContent>
                          <div className="px-5 pb-5 border-t border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
                            <div className="pt-5">
                              <WorkflowTimeline request={request} />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </CardContent>
                    </Card>
                  </Collapsible>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
