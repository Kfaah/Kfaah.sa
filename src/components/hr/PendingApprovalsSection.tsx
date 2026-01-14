import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";

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
  const getRequester = (request: any) => {
    return employees.find((emp) => emp.user_id === request.user_id);
  };

  const totalPending = substituteRequests.length + managerRequests.length + hrManagerRequests.length + executiveRequests.length;

  if (totalPending === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <UserCheck className="w-16 h-16 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-foreground font-semibold text-lg">لا توجد موافقات معلقة</p>
              <p className="text-sm text-muted-foreground">
                ستظهر هنا الطلبات التي تحتاج موافقتك كموظف بديل أو مدير مباشر أو مدير تنفيذي
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* كموظف بديل */}
      {substituteRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              موافقتك كموظف بديل
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                {substituteRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {substituteRequests.map((request: any) => {
                const requester = getRequester(request);
                return (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-amber-50/50 border-amber-200"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-300 flex-shrink-0">
                      {requester?.avatar_url ? (
                        <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-amber-400 flex items-center justify-center text-white font-bold">
                          {requester?.full_name?.charAt(0) || "؟"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {requester?.full_name || "موظف"}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {request.hr_request_types?.name_ar} • {request.request_number}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPreview(request, "substitute")}
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">استعراض</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onApproveSubstitute(request.id)}
                        disabled={isApprovingSubstitute}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {isApprovingSubstitute ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            <span className="hidden sm:inline">موافقة</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(request.id, "substitute")}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">رفض</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* كمدير مباشر */}
      {managerRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              موافقتك كمدير مباشر
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {managerRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {managerRequests.map((request: any) => {
                const requester = getRequester(request);
                return (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-blue-50/50 border-blue-200"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-300 flex-shrink-0">
                      {requester?.avatar_url ? (
                        <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-400 flex items-center justify-center text-white font-bold">
                          {requester?.full_name?.charAt(0) || "؟"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {requester?.full_name || "موظف"}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {request.hr_request_types?.name_ar} • {request.request_number}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPreview(request, "manager")}
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">استعراض</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onApproveManager(request.id)}
                        disabled={isApprovingManager}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isApprovingManager ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            <span className="hidden sm:inline">موافقة</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(request.id, "manager")}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">رفض</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* كمدير موارد بشرية */}
      {hrManagerRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              موافقتك كمدير موارد بشرية
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {hrManagerRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {hrManagerRequests.map((request: any) => {
                const requester = getRequester(request);
                return (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-green-50/50 border-green-200"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-green-300 flex-shrink-0">
                      {requester?.avatar_url ? (
                        <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-green-400 flex items-center justify-center text-white font-bold">
                          {requester?.full_name?.charAt(0) || "؟"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {requester?.full_name || "موظف"}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {request.hr_request_types?.name_ar} • {request.request_number}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPreview(request, "hr_manager")}
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">استعراض</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onApproveHrManager(request.id)}
                        disabled={isApprovingHrManager}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApprovingHrManager ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            <span className="hidden sm:inline">موافقة</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(request.id, "hr_manager")}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">رفض</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* كمدير تنفيذي */}
      {executiveRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              موافقتك كمدير تنفيذي
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                {executiveRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {executiveRequests.map((request: any) => {
                const requester = getRequester(request);
                return (
                  <div
                    key={request.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-purple-50/50 border-purple-200"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-300 flex-shrink-0">
                      {requester?.avatar_url ? (
                        <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-purple-400 flex items-center justify-center text-white font-bold">
                          {requester?.full_name?.charAt(0) || "؟"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {requester?.full_name || "موظف"}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {request.hr_request_types?.name_ar} • {request.request_number}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPreview(request, "executive")}
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">استعراض</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onApproveExecutive(request.id)}
                        disabled={isApprovingExecutive}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {isApprovingExecutive ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            <span className="hidden sm:inline">موافقة</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReject(request.id, "executive")}
                        className="border-red-300 text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        <span className="hidden sm:inline">رفض</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
