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
    <div className="space-y-3">
      {/* Category Header */}
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Badge variant="secondary" className="text-xs">{requests.length}</Badge>
      </div>

      {/* Requests */}
      <div className="space-y-2">
        {requests.map((request: any) => {
          const requester = getRequester(request);
          return (
            <Card key={request.id} className="p-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <Avatar className="h-9 w-9">
                  <AvatarImage src={requester?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-muted">
                    {requester?.full_name?.charAt(0) || "؟"}
                  </AvatarFallback>
                </Avatar>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {requester?.full_name || "موظف"}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{request.hr_request_types?.name_ar}</span>
                    <span>•</span>
                    <span>{request.request_number}</span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onPreview(request)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onApprove(request.id)}
                    disabled={isApproving}
                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isApproving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline text-xs">موافقة</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(request.id)}
                    className="h-8 w-8 p-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">الموافقات المعلقة</h1>
          <p className="text-sm text-muted-foreground">الطلبات التي تحتاج موافقتك</p>
        </div>
        {totalPending > 0 && (
          <Badge variant="destructive" className="text-xs">
            {totalPending} معلق
          </Badge>
        )}
      </div>

      {/* Empty State */}
      {totalPending === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <UserCheck className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">لا توجد موافقات معلقة</h3>
            <p className="text-sm text-muted-foreground">
              ستظهر هنا الطلبات التي تحتاج موافقتك
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <ApprovalCategory
            title="موافقتك كموظف بديل"
            icon={Users}
            requests={substituteRequests}
            employees={employees}
            onApprove={onApproveSubstitute}
            onReject={(id) => onReject(id, "substitute")}
            onPreview={(req) => onPreview(req, "substitute")}
            isApproving={isApprovingSubstitute}
          />
          <ApprovalCategory
            title="موافقتك كمدير مباشر"
            icon={Briefcase}
            requests={managerRequests}
            employees={employees}
            onApprove={onApproveManager}
            onReject={(id) => onReject(id, "manager")}
            onPreview={(req) => onPreview(req, "manager")}
            isApproving={isApprovingManager}
          />
          <ApprovalCategory
            title="موافقتك كمدير موارد بشرية"
            icon={UserCheck}
            requests={hrManagerRequests}
            employees={employees}
            onApprove={onApproveHrManager}
            onReject={(id) => onReject(id, "hr_manager")}
            onPreview={(req) => onPreview(req, "hr_manager")}
            isApproving={isApprovingHrManager}
          />
          <ApprovalCategory
            title="موافقتك كمدير تنفيذي"
            icon={Crown}
            requests={executiveRequests}
            employees={employees}
            onApprove={onApproveExecutive}
            onReject={(id) => onReject(id, "executive")}
            onPreview={(req) => onPreview(req, "executive")}
            isApproving={isApprovingExecutive}
          />
        </div>
      )}
    </div>
  );
}
