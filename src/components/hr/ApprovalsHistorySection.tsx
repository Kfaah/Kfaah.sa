import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserCheck, CheckCircle2, Eye, History } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
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

interface HistoryCategoryProps {
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
  onViewRequest: (request: any) => void;
  dateField: string;
}

function HistoryCategory({
  title,
  icon: Icon,
  requests,
  employees,
  color,
  onViewRequest,
  dateField,
}: HistoryCategoryProps) {
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
          <p className="text-xs text-muted-foreground">{requests.length} موافقة</p>
        </div>
        <Badge className={cn("text-xs", color.gradient, "text-white border-0")}>
          {requests.length}
        </Badge>
      </div>

      {/* Requests */}
      <div className="space-y-2">
        {requests.map((request: any) => {
          const requester = getRequester(request);
          const approvedDate = request[dateField];
          
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

              {/* Date */}
              {approvedDate && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  {format(new Date(approvedDate), "d MMM", { locale: ar })}
                </div>
              )}
              
              {/* Action */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewRequest(request)}
                className="h-9 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">عرض</span>
              </Button>
            </div>
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

  const categories = [
    {
      title: "الموافقات كموظف بديل",
      icon: Users,
      requests: approvedAsSubstitute,
      color: {
        gradient: "bg-gradient-to-br from-amber-500 to-orange-500",
        light: "bg-amber-50/50 dark:bg-amber-950/20",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800/50",
      },
      dateField: "substitute_approved_at",
    },
    {
      title: "الموافقات كمدير مباشر",
      icon: UserCheck,
      requests: approvedAsManager,
      color: {
        gradient: "bg-gradient-to-br from-blue-500 to-indigo-500",
        light: "bg-blue-50/50 dark:bg-blue-950/20",
        text: "text-blue-700 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800/50",
      },
      dateField: "manager_approved_at",
    },
  ];

  return (
    <Card className="p-6 border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">سجل الموافقات</h2>
            <p className="text-xs text-muted-foreground">الطلبات التي وافقت عليها</p>
          </div>
        </div>
        {totalHistory > 0 && (
          <Badge variant="secondary" className="text-xs">
            {totalHistory} موافقة
          </Badge>
        )}
      </div>

      {/* Empty State */}
      {totalHistory === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">لا يوجد سجل موافقات</h3>
          <p className="text-sm text-muted-foreground mb-4">عند اعتمادك لأي طلب سيظهر هنا</p>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <HistoryCategory
              key={category.title}
              title={category.title}
              icon={category.icon}
              requests={category.requests}
              employees={employees}
              color={category.color}
              onViewRequest={onViewRequest}
              dateField={category.dateField}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
