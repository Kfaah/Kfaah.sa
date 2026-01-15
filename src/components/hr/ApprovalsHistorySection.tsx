import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserCheck, CheckCircle2, Eye, History } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

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

interface HistoryCategoryProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  requests: any[];
  employees: Employee[];
  onViewRequest: (request: any) => void;
  dateField: string;
}

function HistoryCategory({
  title,
  icon: Icon,
  requests,
  employees,
  onViewRequest,
  dateField,
}: HistoryCategoryProps) {
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
          const approvedDate = request[dateField];
          
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

                {/* Date */}
                {approvedDate && (
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {format(new Date(approvedDate), "d MMM", { locale: ar })}
                  </div>
                )}
                
                {/* Action */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewRequest(request)}
                  className="h-8 gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">عرض</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ApprovalsHistorySection({
  approvedAsSubstitute,
  approvedAsManager,
  employees,
  onViewRequest,
  onNavigateToPending,
}: ApprovalsHistorySectionProps) {
  const totalHistory = approvedAsSubstitute.length + approvedAsManager.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">سجل الموافقات</h1>
          <p className="text-sm text-muted-foreground">الطلبات التي وافقت عليها</p>
        </div>
        {totalHistory > 0 && (
          <Badge variant="outline" className="text-xs">
            {totalHistory} موافقة
          </Badge>
        )}
      </div>

      {/* Empty State */}
      {totalHistory === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">لا يوجد سجل موافقات</h3>
            <p className="text-sm text-muted-foreground mb-4">
              عند اعتمادك لأي طلب سيظهر هنا
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onNavigateToPending}
              className="gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              الموافقات المعلقة
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <HistoryCategory
            title="موافقاتي كموظف بديل"
            icon={Users}
            requests={approvedAsSubstitute}
            employees={employees}
            onViewRequest={onViewRequest}
            dateField="substitute_approved_at"
          />
          <HistoryCategory
            title="موافقاتي كمدير مباشر"
            icon={UserCheck}
            requests={approvedAsManager}
            employees={employees}
            onViewRequest={onViewRequest}
            dateField="manager_approved_at"
          />
        </div>
      )}
    </div>
  );
}
