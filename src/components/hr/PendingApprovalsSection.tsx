import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  ClipboardList,
  Crown,
  Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  avatar_url: string | null;
}

interface PendingApprovalsSectionProps {
  substituteRequests: any[];
  managerRequests: any[];
  hrManagerRequests: any[];
  executiveRequests: any[];
  employees: Employee[];
  onApproveSubstitute: (id: string) => void;
  onApproveManager: (id: string) => void;
  onApproveHrManager: (id: string) => void;
  onApproveExecutive: (id: string) => void;
  onReject: (id: string, type: "substitute" | "manager" | "hr_manager" | "executive") => void;
  onPreview: (request: any, type: "substitute" | "manager" | "hr_manager" | "executive") => void;
  isApprovingSubstitute: boolean;
  isApprovingManager: boolean;
  isApprovingHrManager: boolean;
  isApprovingExecutive: boolean;
}

interface ApprovalCategoryProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  requests: any[];
  employees: Employee[];
  color: {
    gradient: string;
    bg: string;
    border: string;
    iconBg: string;
    text: string;
    button: string;
  };
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPreview: (request: any) => void;
  isApproving: boolean;
}

function ApprovalCategory({
  title,
  icon: Icon,
  requests,
  employees,
  color,
  onApprove,
  onReject,
  onPreview,
  isApproving,
}: ApprovalCategoryProps) {
  const getRequester = (request: any) => {
    return employees.find((emp) => emp.user_id === request.user_id);
  };

  if (requests.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Category Header */}
      <div className="flex items-center gap-3">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", color.gradient)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{requests.length} طلب بانتظار موافقتك</p>
        </div>
        <Badge className={cn("px-4 py-1.5 text-sm font-bold", color.bg, color.text)}>
          {requests.length}
        </Badge>
      </div>

      {/* Requests Grid */}
      <div className="grid gap-3">
        <AnimatePresence>
          {requests.map((request: any, index: number) => {
            const requester = getRequester(request);
            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={cn(
                  "border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden",
                  color.border
                )}>
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 p-4">
                      {/* Avatar */}
                      <div className={cn(
                        "w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-md",
                        color.border
                      )}>
                        {requester?.avatar_url ? (
                          <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className={cn("w-full h-full flex items-center justify-center text-white font-bold text-xl", color.gradient)}>
                            {requester?.full_name?.charAt(0) || "؟"}
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-foreground text-base mb-1">
                          {requester?.full_name || "موظف"}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className={cn("text-xs", color.bg, color.text)}>
                            {request.hr_request_types?.name_ar}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {request.request_number}
                          </span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onPreview(request)}
                          className="rounded-xl border-primary/30 text-primary hover:bg-primary/10 h-10 px-3"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onApprove(request.id)}
                          disabled={isApproving}
                          className={cn("rounded-xl h-10 px-4 gap-1.5", color.button)}
                        >
                          {isApproving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="hidden sm:inline">موافقة</span>
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReject(request.id)}
                          className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 h-10 px-3"
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function PendingApprovalsSection({
  substituteRequests,
  managerRequests,
  hrManagerRequests,
  executiveRequests,
  employees,
  onApproveSubstitute,
  onApproveManager,
  onApproveHrManager,
  onApproveExecutive,
  onReject,
  onPreview,
  isApprovingSubstitute,
  isApprovingManager,
  isApprovingHrManager,
  isApprovingExecutive,
}: PendingApprovalsSectionProps) {
  const totalPending = substituteRequests.length + managerRequests.length + hrManagerRequests.length + executiveRequests.length;

  if (totalPending === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <UserCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">الموافقات المعلقة</h2>
            <p className="text-muted-foreground">الطلبات التي تحتاج موافقتك</p>
          </div>
        </div>

        {/* Empty State */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-card via-card to-amber-500/5 overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-20 relative">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl" />
            </div>
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 flex flex-col items-center"
            >
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-6 shadow-lg">
                <UserCheck className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">لا توجد موافقات معلقة</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                ستظهر هنا الطلبات التي تحتاج موافقتك كموظف بديل أو مدير
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = [
    {
      title: "موافقتك كموظف بديل",
      icon: Users,
      requests: substituteRequests,
      color: {
        gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
        bg: "bg-amber-500/10",
        border: "border-l-4 border-l-amber-500",
        iconBg: "bg-amber-100",
        text: "text-amber-700",
        button: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md",
      },
      onApprove: onApproveSubstitute,
      onReject: (id: string) => onReject(id, "substitute"),
      onPreview: (req: any) => onPreview(req, "substitute"),
      isApproving: isApprovingSubstitute,
    },
    {
      title: "موافقتك كمدير مباشر",
      icon: Briefcase,
      requests: managerRequests,
      color: {
        gradient: "bg-gradient-to-br from-blue-500 to-indigo-500",
        bg: "bg-blue-500/10",
        border: "border-l-4 border-l-blue-500",
        iconBg: "bg-blue-100",
        text: "text-blue-700",
        button: "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md",
      },
      onApprove: onApproveManager,
      onReject: (id: string) => onReject(id, "manager"),
      onPreview: (req: any) => onPreview(req, "manager"),
      isApproving: isApprovingManager,
    },
    {
      title: "موافقتك كمدير موارد بشرية",
      icon: UserCheck,
      requests: hrManagerRequests,
      color: {
        gradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
        bg: "bg-emerald-500/10",
        border: "border-l-4 border-l-emerald-500",
        iconBg: "bg-emerald-100",
        text: "text-emerald-700",
        button: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md",
      },
      onApprove: onApproveHrManager,
      onReject: (id: string) => onReject(id, "hr_manager"),
      onPreview: (req: any) => onPreview(req, "hr_manager"),
      isApproving: isApprovingHrManager,
    },
    {
      title: "موافقتك كمدير تنفيذي",
      icon: Crown,
      requests: executiveRequests,
      color: {
        gradient: "bg-gradient-to-br from-purple-500 to-violet-500",
        bg: "bg-purple-500/10",
        border: "border-l-4 border-l-purple-500",
        iconBg: "bg-purple-100",
        text: "text-purple-700",
        button: "bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white shadow-md",
      },
      onApprove: onApproveExecutive,
      onReject: (id: string) => onReject(id, "executive"),
      onPreview: (req: any) => onPreview(req, "executive"),
      isApproving: isApprovingExecutive,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <UserCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">الموافقات المعلقة</h2>
            <p className="text-muted-foreground">الطلبات التي تحتاج موافقتك</p>
          </div>
        </div>
        <Badge className="px-4 py-2 text-sm bg-red-500/10 text-red-600 border-red-200 animate-pulse">
          {totalPending} طلب معلق
        </Badge>
      </div>

      {/* Categories */}
      {categories.map((category) => (
        <ApprovalCategory
          key={category.title}
          title={category.title}
          icon={category.icon}
          requests={category.requests}
          employees={employees}
          color={category.color}
          onApprove={category.onApprove}
          onReject={category.onReject}
          onPreview={category.onPreview}
          isApproving={category.isApproving}
        />
      ))}
    </div>
  );
}
