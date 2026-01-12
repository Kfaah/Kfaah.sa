import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Heart,
  AlertTriangle,
  DollarSign,
  Award,
  BarChart3,
  ClipboardList,
  Settings2,
  UserCheck,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { NewRequestDialog } from "@/components/hr/NewRequestDialog";
import { RequestDetailsDialog } from "@/components/hr/RequestDetailsDialog";
import { AdminRequestsPanel } from "@/components/hr/AdminRequestsPanel";
import { LeaveBalanceCard } from "@/components/hr/LeaveBalanceCard";
import { HRStatisticsPanel } from "@/components/hr/HRStatisticsPanel";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  Heart,
  AlertTriangle,
  Clock,
  DollarSign,
  Award,
  FileText,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
  approved: { label: "موافق عليه", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

export default function HRRequests() {
  const { user: authUser } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminActiveTab, setAdminActiveTab] = useState("requests");
  const [employeeActiveTab, setEmployeeActiveTab] = useState("my-requests");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<{ id: string; type: 'substitute' | 'manager' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const isAdmin = user.role === "مدير النظام";

  // جلب أنواع الطلبات
  const { data: requestTypes = [] } = useQuery({
    queryKey: ["hr-request-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_request_types")
        .select("*")
        .eq("is_active", true)
        .order("name_ar");
      if (error) throw error;
      return data;
    },
  });

  // جلب طلباتي (للموظفين فقط)
  const { data: myRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-hr-requests", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id || isAdmin) return [];
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (*)
        `)
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id && !isAdmin,
  });

  // جلب أرصدة الإجازات (للموظفين فقط)
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["my-leave-balances", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id || isAdmin) return [];
      const { data, error } = await supabase
        .from("hr_leave_balances")
        .select(`
          *,
          hr_request_types (*)
        `)
        .eq("user_id", authUser.id)
        .eq("year", new Date().getFullYear());
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id && !isAdmin,
  });

  // جلب قائمة الموظفين (لجميع المستخدمين - للموظف البديل والمدير المباشر)
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name, job_role, avatar_url, signature_url")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // جلب الطلبات التي تحتاج موافقة كموظف بديل
  const { data: substituteRequests = [], isLoading: loadingSubstitute } = useQuery({
    queryKey: ["pending-substitute-approvals", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id || isAdmin) return [];
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("substitute_employee_id", authUser.id)
        .eq("substitute_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id && !isAdmin,
  });

  // جلب الطلبات التي تحتاج موافقة كمدير مباشر
  const { data: managerRequests = [], isLoading: loadingManager } = useQuery({
    queryKey: ["pending-manager-approvals", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id || isAdmin) return [];
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("direct_manager_id", authUser.id)
        .eq("manager_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id && !isAdmin,
  });

  // موافقة كموظف بديل
  const substituteApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url")
        .eq("user_id", authUser?.id)
        .single();

      if (!employee?.signature_url) {
        throw new Error("يجب إضافة توقيعك في الملف الشخصي أولاً");
      }

      const { error } = await supabase
        .from("hr_requests")
        .update({
          substitute_approved: true,
          substitute_approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      toast.success("تمت موافقتك كموظف بديل");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // موافقة كمدير مباشر
  const managerApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url")
        .eq("user_id", authUser?.id)
        .single();

      if (!employee?.signature_url) {
        throw new Error("يجب إضافة توقيعك في الملف الشخصي أولاً");
      }

      const { error } = await supabase
        .from("hr_requests")
        .update({
          manager_approved: true,
          manager_approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-manager-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      toast.success("تمت موافقتك كمدير مباشر");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // رفض الطلب (كموظف بديل أو مدير مباشر)
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, reason, type }: { requestId: string; reason: string; type: 'substitute' | 'manager' }) => {
      const { error } = await supabase
        .from("hr_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-manager-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      toast.success("تم رفض الطلب");
      setRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenRejectDialog = (requestId: string, type: 'substitute' | 'manager') => {
    setRejectingRequest({ id: requestId, type });
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectingRequest || !rejectionReason.trim()) {
      toast.error("يرجى إدخال سبب الرفض");
      return;
    }
    rejectRequestMutation.mutate({
      requestId: rejectingRequest.id,
      reason: rejectionReason,
      type: rejectingRequest.type,
    });
  };

  const pendingApprovalsCount = (substituteRequests?.length || 0) + (managerRequests?.length || 0);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getRequestIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || FileText;
    return Icon;
  };

  // واجهة المدير
  if (isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">إدارة طلبات الموارد البشرية</h1>
              <p className="text-muted-foreground">مراجعة واعتماد طلبات الموظفين والإحصائيات</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                onClick={() => navigate("/hr-templates")}
                className="gap-2 border-2 hover:bg-primary/10 hover:border-primary"
              >
                <Settings2 className="w-4 h-4" />
                إدارة النماذج
              </Button>
              <Button 
                onClick={() => setIsNewRequestOpen(true)}
                className="bg-gradient-to-r from-accent to-teal-500 hover:from-accent/90 hover:to-teal-500/90 text-white gap-2"
              >
                <Plus className="w-4 h-4" />
                إنشاء طلب لموظف
              </Button>
            </div>
          </div>

          {/* التبويبات المركزية */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-4 p-2 bg-white rounded-2xl shadow-lg border">
              <button
                onClick={() => setAdminActiveTab("requests")}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all ${
                  adminActiveTab === "requests"
                    ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-md"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                الطلبات
              </button>
              <button
                onClick={() => setAdminActiveTab("statistics")}
                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all ${
                  adminActiveTab === "statistics"
                    ? "bg-gradient-to-r from-accent to-teal-500 text-white shadow-md"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                التقارير والإحصائيات
              </button>
            </div>
          </div>

          {/* المحتوى */}
          {adminActiveTab === "requests" ? (
            <AdminRequestsPanel requestTypes={requestTypes} />
          ) : (
            <HRStatisticsPanel />
          )}

          {/* Dialog إنشاء طلب لموظف */}
          <NewRequestDialog
            open={isNewRequestOpen}
            onOpenChange={setIsNewRequestOpen}
            requestTypes={requestTypes}
            leaveBalances={[]}
            isAdmin={true}
            employees={employees}
          />

          {/* Dialog تفاصيل الطلب */}
          <RequestDetailsDialog
            request={selectedRequest}
            open={!!selectedRequest}
            onOpenChange={(open) => !open && setSelectedRequest(null)}
            isAdmin={true}
          />
        </div>
      </DashboardLayout>
    );
  }

  // واجهة الموظف

  // جلب بيانات مقدم الطلب لصفحة الموافقات المعلقة
  const getRequesterData = (request: any) => {
    return employees.find((emp: any) => emp.user_id === request.user_id);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">الموارد البشرية</h1>
            <p className="text-muted-foreground">إدارة الإجازات والاستئذانات والطلبات الإدارية</p>
          </div>
          <Button 
            onClick={() => setIsNewRequestOpen(true)}
            className="bg-gradient-to-r from-accent to-teal-500 hover:from-accent/90 hover:to-teal-500/90 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            طلب جديد
          </Button>
        </div>

        {/* أرصدة الإجازات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {requestTypes
            .filter((type: any) => type.deducts_from_balance)
            .map((type: any) => {
              const balance = leaveBalances.find((b: any) => b.request_type_id === type.id);
              const Icon = getRequestIcon(type.icon);
              return (
                <LeaveBalanceCard
                  key={type.id}
                  title={type.name_ar}
                  icon={Icon}
                  color={type.color}
                  total={balance?.total_days || type.max_days || 0}
                  used={balance?.used_days || 0}
                  remaining={balance?.remaining_days ?? (type.max_days || 0)}
                />
              );
            })}
        </div>

        {/* التبويبات */}
        <Tabs value={employeeActiveTab} onValueChange={setEmployeeActiveTab} dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-requests" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              طلباتي
            </TabsTrigger>
            <TabsTrigger value="pending-approvals" className="gap-2">
              <UserCheck className="w-4 h-4" />
              موافقات معلقة
              {pendingApprovalsCount > 0 && (
                <Badge variant="destructive" className="mr-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingApprovalsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* طلباتي */}
          <TabsContent value="my-requests" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>سجل الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingRequests ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : myRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
                    <p className="text-muted-foreground mb-4">لم تقم بتقديم أي طلبات بعد</p>
                    <Button 
                      onClick={() => setIsNewRequestOpen(true)}
                      variant="outline"
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      تقديم طلب جديد
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {myRequests.map((request: any) => {
                      const Icon = getRequestIcon(request.hr_request_types?.icon);
                      return (
                        <div 
                          key={request.id} 
                          className="flex items-center gap-4 p-4 rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <div className={`w-12 h-12 rounded-xl ${request.hr_request_types?.color || 'bg-primary'} flex items-center justify-center`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">
                                {request.hr_request_types?.name_ar}
                              </h3>
                              {getStatusBadge(request.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {request.request_number}
                              </span>
                              {request.start_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(request.start_date), "d MMM yyyy", { locale: ar })}
                                  {request.end_date && request.end_date !== request.start_date && (
                                    <> - {format(new Date(request.end_date), "d MMM yyyy", { locale: ar })}</>
                                  )}
                                </span>
                              )}
                              {request.days_count && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {request.days_count} يوم
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(request.created_at), "d MMM yyyy", { locale: ar })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* الموافقات المعلقة */}
          <TabsContent value="pending-approvals" className="mt-4 space-y-6">
            {/* كموظف بديل */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  موافقتك كموظف بديل
                  {substituteRequests.length > 0 && (
                    <Badge variant="secondary">{substituteRequests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSubstitute ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : substituteRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <UserCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">لا توجد طلبات تحتاج موافقتك كموظف بديل</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {substituteRequests.map((request: any) => {
                      const requester = getRequesterData(request);
                      return (
                        <div key={request.id} className="flex items-center gap-4 p-4 rounded-xl border bg-amber-50/50 border-amber-200">
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-300">
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-amber-400 flex items-center justify-center text-white font-bold">
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">{requester?.full_name || "موظف"}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.hr_request_types?.name_ar} • {request.request_number}
                            </div>
                            {request.start_date && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(request.start_date), "d MMM yyyy", { locale: ar })}
                                {request.days_count && ` (${request.days_count} يوم)`}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => substituteApproveMutation.mutate(request.id)}
                              disabled={substituteApproveMutation.isPending}
                              className="bg-amber-600 hover:bg-amber-700"
                            >
                              {substituteApproveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 ml-1" />
                                  موافقة
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRejectDialog(request.id, 'substitute')}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 ml-1" />
                              رفض
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* كمدير مباشر */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  موافقتك كمدير مباشر
                  {managerRequests.length > 0 && (
                    <Badge variant="secondary">{managerRequests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingManager ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  </div>
                ) : managerRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">لا توجد طلبات تحتاج موافقتك كمدير مباشر</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {managerRequests.map((request: any) => {
                      const requester = getRequesterData(request);
                      return (
                        <div key={request.id} className="flex items-center gap-4 p-4 rounded-xl border bg-blue-50/50 border-blue-200">
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-300">
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-blue-400 flex items-center justify-center text-white font-bold">
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">{requester?.full_name || "موظف"}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.hr_request_types?.name_ar} • {request.request_number}
                            </div>
                            {request.start_date && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(request.start_date), "d MMM yyyy", { locale: ar })}
                                {request.days_count && ` (${request.days_count} يوم)`}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => managerApproveMutation.mutate(request.id)}
                              disabled={managerApproveMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {managerApproveMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 ml-1" />
                                  موافقة
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenRejectDialog(request.id, 'manager')}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 ml-1" />
                              رفض
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog تقديم طلب جديد */}
        <NewRequestDialog
          open={isNewRequestOpen}
          onOpenChange={setIsNewRequestOpen}
          requestTypes={requestTypes}
          leaveBalances={leaveBalances}
          isAdmin={false}
          employees={employees}
        />

        {/* Dialog تفاصيل الطلب */}
        <RequestDetailsDialog
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          isAdmin={false}
        />

        {/* Dialog رفض الطلب */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                رفض الطلب
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">سبب الرفض *</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="أدخل سبب رفض الطلب..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmReject}
                disabled={rejectRequestMutation.isPending || !rejectionReason.trim()}
              >
                {rejectRequestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                ) : (
                  <XCircle className="w-4 h-4 ml-2" />
                )}
                تأكيد الرفض
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
