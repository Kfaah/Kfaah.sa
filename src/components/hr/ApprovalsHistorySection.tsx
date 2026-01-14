import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, CheckCircle2, Eye } from "lucide-react";
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

  const totalHistory = approvedAsSubstitute.length + approvedAsManager.length;

  if (totalHistory === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle2 className="w-16 h-16 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-foreground font-semibold text-lg">لا يوجد سجل موافقات حتى الآن</p>
              <p className="text-sm text-muted-foreground">
                عند اعتمادك لأي طلب كموظف بديل أو كمدير مباشر سيظهر هنا
              </p>
            </div>
            <Button variant="outline" className="mt-2" onClick={onNavigateToPending}>
              الانتقال إلى الموافقات المعلقة
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* موافقاتي كموظف بديل */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            موافقاتي كموظف بديل
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              {approvedAsSubstitute.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedAsSubstitute.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">لا توجد موافقات سابقة كموظف بديل</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {approvedAsSubstitute.map((request: any) => {
                const requester = getRequester(request);
                const isApproved = request.status === "approved";
                const isRejected = request.status === "rejected";
                return (
                  <div
                    key={request.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      isApproved
                        ? "bg-green-50/50 border-green-200"
                        : isRejected
                        ? "bg-red-50/50 border-red-200"
                        : "bg-amber-50/50 border-amber-200"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0 ${
                        isApproved
                          ? "border-green-300"
                          : isRejected
                          ? "border-red-300"
                          : "border-amber-300"
                      }`}
                    >
                      {requester?.avatar_url ? (
                        <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className={`w-full h-full flex items-center justify-center text-white font-bold ${
                            isApproved ? "bg-green-400" : isRejected ? "bg-red-400" : "bg-amber-400"
                          }`}
                        >
                          {requester?.full_name?.charAt(0) || "؟"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">
                          {requester?.full_name || "موظف"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            isApproved
                              ? "border-green-300 text-green-700 bg-green-50"
                              : isRejected
                              ? "border-red-300 text-red-700 bg-red-50"
                              : "border-amber-300 text-amber-700 bg-amber-50"
                          }`}
                        >
                          {isApproved ? "تمت الموافقة النهائية" : isRejected ? "مرفوض" : "قيد المعالجة"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {request.hr_request_types?.name_ar} • {request.request_number}
                      </div>
                      {request.substitute_approved_at && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          وافقت بتاريخ: {format(new Date(request.substitute_approved_at), "d MMM yyyy", { locale: ar })}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewRequest(request)}
                      className="border-primary text-primary hover:bg-primary/10 flex-shrink-0"
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      <span className="hidden sm:inline">استعراض</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* موافقاتي كمدير مباشر */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            موافقاتي كمدير مباشر
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {approvedAsManager.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedAsManager.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <UserCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">لا توجد موافقات سابقة كمدير مباشر</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {approvedAsManager.map((request: any) => {
                const requester = getRequester(request);
                const isApproved = request.status === "approved";
                const isRejected = request.status === "rejected";
                return (
                  <div
                    key={request.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border ${
                      isApproved
                        ? "bg-green-50/50 border-green-200"
                        : isRejected
                        ? "bg-red-50/50 border-red-200"
                        : "bg-blue-50/50 border-blue-200"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0 ${
                        isApproved
                          ? "border-green-300"
                          : isRejected
                          ? "border-red-300"
                          : "border-blue-300"
                      }`}
                    >
                      {requester?.avatar_url ? (
                        <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className={`w-full h-full flex items-center justify-center text-white font-bold ${
                            isApproved ? "bg-green-400" : isRejected ? "bg-red-400" : "bg-blue-400"
                          }`}
                        >
                          {requester?.full_name?.charAt(0) || "؟"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">
                          {requester?.full_name || "موظف"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            isApproved
                              ? "border-green-300 text-green-700 bg-green-50"
                              : isRejected
                              ? "border-red-300 text-red-700 bg-red-50"
                              : "border-blue-300 text-blue-700 bg-blue-50"
                          }`}
                        >
                          {isApproved ? "تمت الموافقة النهائية" : isRejected ? "مرفوض" : "قيد المعالجة"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {request.hr_request_types?.name_ar} • {request.request_number}
                      </div>
                      {request.manager_approved_at && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                          وافقت بتاريخ: {format(new Date(request.manager_approved_at), "d MMM yyyy", { locale: ar })}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewRequest(request)}
                      className="border-primary text-primary hover:bg-primary/10 flex-shrink-0"
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      <span className="hidden sm:inline">استعراض</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
