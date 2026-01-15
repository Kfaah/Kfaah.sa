import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, CheckCircle2, Eye, Clock, XCircle, History } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  avatar_url: string | null;
}

interface ApprovalsHistorySectionProps {
  approvedAsSubstitute: any[];
  approvedAsManager: any[];
  employees: Employee[];
  onViewRequest: (request: any) => void;
  onNavigateToPending: () => void;
}

const statusStyles = {
  approved: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
    label: "تمت الموافقة"
  },
  rejected: {
    bg: "bg-red-500/10",
    text: "text-red-600",
    border: "border-red-500/30",
    icon: XCircle,
    label: "مرفوض"
  },
  pending: {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    border: "border-amber-500/30",
    icon: Clock,
    label: "قيد المعالجة"
  }
};

export function ApprovalsHistorySection({
  approvedAsSubstitute,
  approvedAsManager,
  employees,
  onViewRequest,
  onNavigateToPending,
}: ApprovalsHistorySectionProps) {
  const getRequester = (request: any) => {
    return employees.find((emp) => emp.user_id === request.user_id);
  };

  const getStatusStyle = (status: string) => {
    if (status === "approved") return statusStyles.approved;
    if (status === "rejected") return statusStyles.rejected;
    return statusStyles.pending;
  };

  const totalHistory = approvedAsSubstitute.length + approvedAsManager.length;

  if (totalHistory === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <History className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">سجل الموافقات</h2>
            <p className="text-muted-foreground">الطلبات التي وافقت عليها سابقاً</p>
          </div>
        </div>

        {/* Empty State */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-card via-card to-emerald-500/5 overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-20 relative">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl" />
            </div>
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-6 shadow-lg">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">لا يوجد سجل موافقات</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-sm">
                عند اعتمادك لأي طلب كموظف بديل أو كمدير مباشر سيظهر هنا
              </p>
              <Button 
                variant="outline" 
                onClick={onNavigateToPending}
                className="gap-2 rounded-xl border-primary text-primary hover:bg-primary/10"
              >
                <UserCheck className="w-4 h-4" />
                الانتقال إلى الموافقات المعلقة
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <History className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">سجل الموافقات</h2>
            <p className="text-muted-foreground">الطلبات التي وافقت عليها سابقاً</p>
          </div>
        </div>
        <Badge variant="secondary" className="px-4 py-2 text-sm">
          {totalHistory} موافقة
        </Badge>
      </div>

      {/* موافقاتي كموظف بديل */}
      {approvedAsSubstitute.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground">موافقاتي كموظف بديل</h3>
              <p className="text-sm text-muted-foreground">{approvedAsSubstitute.length} موافقة</p>
            </div>
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {approvedAsSubstitute.map((request: any, index: number) => {
                const requester = getRequester(request);
                const statusStyle = getStatusStyle(request.status);
                const StatusIcon = statusStyle.icon;
                
                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-md border-2 border-amber-200">
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-foreground">
                                {requester?.full_name || "موظف"}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs gap-1", statusStyle.bg, statusStyle.text, statusStyle.border)}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusStyle.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{request.hr_request_types?.name_ar}</span>
                              <span>•</span>
                              <span>{request.request_number}</span>
                            </div>
                            {request.substitute_approved_at && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                وافقت بتاريخ: {format(new Date(request.substitute_approved_at), "d MMM yyyy", { locale: ar })}
                              </div>
                            )}
                          </div>
                          
                          {/* Action */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewRequest(request)}
                            className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            عرض
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* موافقاتي كمدير مباشر */}
      {approvedAsManager.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
              <UserCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground">موافقاتي كمدير مباشر</h3>
              <p className="text-sm text-muted-foreground">{approvedAsManager.length} موافقة</p>
            </div>
          </div>

          <div className="grid gap-3">
            <AnimatePresence>
              {approvedAsManager.map((request: any, index: number) => {
                const requester = getRequester(request);
                const statusStyle = getStatusStyle(request.status);
                const StatusIcon = statusStyle.icon;
                
                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-md border-2 border-blue-200">
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg">
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-bold text-foreground">
                                {requester?.full_name || "موظف"}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs gap-1", statusStyle.bg, statusStyle.text, statusStyle.border)}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusStyle.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{request.hr_request_types?.name_ar}</span>
                              <span>•</span>
                              <span>{request.request_number}</span>
                            </div>
                            {request.manager_approved_at && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                وافقت بتاريخ: {format(new Date(request.manager_approved_at), "d MMM yyyy", { locale: ar })}
                              </div>
                            )}
                          </div>
                          
                          {/* Action */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewRequest(request)}
                            className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            عرض
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
}
