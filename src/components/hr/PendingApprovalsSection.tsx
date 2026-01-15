import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Crown,
  Briefcase,
} from "lucide-react";
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
    light: string;
    text: string;
    border: string;
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
    <div className={cn(
      "rounded-xl border-2 p-4",
      color.light,
      color.border
    )}>
      {/* Category Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", color.gradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className={cn("font-semibold text-sm", color.text)}>{title}</h3>
          <p className="text-xs text-muted-foreground">{requests.length} طلب بانتظار موافقتك</p>
        </div>
        <Badge className={cn("text-xs", color.gradient, "text-white border-0")}>
          {requests.length}
        </Badge>
      </div>

      {/* Requests */}
      <div className="space-y-2">
        {requests.map((request: any) => {
          const requester = getRequester(request);
          return (
            <div 
              key={request.id} 
              className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
            >
              {/* Avatar */}
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                <AvatarImage src={requester?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-muted font-medium">
                  {requester?.full_name?.charAt(0) || "؟"}
                </AvatarFallback>
              </Avatar>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  {requester?.full_name || "موظف"}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{request.hr_request_types?.name_ar}</span>
                  <span>•</span>
                  <span className="font-mono">{request.request_number}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPreview(request)}
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => onApprove(request.id)}
                  disabled={isApproving}
                  className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  {isApproving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline text-xs">موافقة</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(request.id)}
                  className="h-9 w-9 p-0 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

  const categories = [
    {
      title: "موافقتك كموظف بديل",
      icon: Users,
      requests: substituteRequests,
      color: {
        gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
        light: "bg-amber-50/50 dark:bg-amber-950/20",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800/50",
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
        light: "bg-blue-50/50 dark:bg-blue-950/20",
        text: "text-blue-700 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800/50",
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
        light: "bg-emerald-50/50 dark:bg-emerald-950/20",
        text: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-200 dark:border-emerald-800/50",
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
        light: "bg-purple-50/50 dark:bg-purple-950/20",
        text: "text-purple-700 dark:text-purple-400",
        border: "border-purple-200 dark:border-purple-800/50",
      },
      onApprove: onApproveExecutive,
      onReject: (id: string) => onReject(id, "executive"),
      onPreview: (req: any) => onPreview(req, "executive"),
      isApproving: isApprovingExecutive,
    },
  ];

  return (
    <Card className="p-6 border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
            <UserCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">الموافقات المعلقة</h2>
            <p className="text-xs text-muted-foreground">الطلبات التي تحتاج موافقتك</p>
          </div>
        </div>
        {totalPending > 0 && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            {totalPending} معلق
          </Badge>
        )}
      </div>

      {/* Empty State */}
      {totalPending === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <UserCheck className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">لا توجد موافقات معلقة</h3>
          <p className="text-sm text-muted-foreground">ستظهر هنا الطلبات التي تحتاج موافقتك</p>
        </div>
      ) : (
        <div className="space-y-4">
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
      )}
    </Card>
  );
}
