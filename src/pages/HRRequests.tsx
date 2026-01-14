import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
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
  Heart,
  AlertTriangle,
  DollarSign,
  Award,
  Settings2,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { NewRequestDialog } from "@/components/hr/NewRequestDialog";
import { RequestPreviewDialog } from "@/components/hr/RequestPreviewDialog";
import { AdminRequestsPanel } from "@/components/hr/AdminRequestsPanel";
import { LeaveBalanceCard } from "@/components/hr/LeaveBalanceCard";
import { HRNavigationIcons, HRSection } from "@/components/hr/HRNavigationIcons";
import { MyRequestsSection } from "@/components/hr/MyRequestsSection";
import { PendingApprovalsSection } from "@/components/hr/PendingApprovalsSection";
import { ApprovalsHistorySection } from "@/components/hr/ApprovalsHistorySection";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  Heart,
  AlertTriangle,
  Clock,
  DollarSign,
  Award,
  FileText,
};

export default function HRRequests() {
  const { user: authUser } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [previewRequest, setPreviewRequest] = useState<any>(null);
  const [previewApprovalType, setPreviewApprovalType] = useState<"substitute" | "manager" | "executive">("substitute");
  const [activeSection, setActiveSection] = useState<HRSection>("my-requests");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<{ id: string; type: 'substitute' | 'manager' | 'executive' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const isAdmin = user.role === "مدير النظام";

  // Sync URL with section
  const handleSectionChange = (section: HRSection) => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    next.set("section", section);
    next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    // دعم قديم: بعض الروابط كانت تستخدم ?tab=...
    const sectionParam = (searchParams.get("section") || searchParams.get("tab")) as HRSection | null;

    if (
      sectionParam &&
      ["my-requests", "pending-approvals", "my-approvals-history"].includes(sectionParam)
    ) {
      if (sectionParam !== activeSection) setActiveSection(sectionParam);
    }
  }, [searchParams, activeSection]);

  // Icon helper
  const getRequestIcon = (iconName: string | null): React.ComponentType<{ className?: string }> => {
    return iconMap[iconName || "FileText"] || FileText;
  };

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

  // جلب طلباتي
  const { data: myRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-hr-requests", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
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
    enabled: !!authUser?.id,
  });

  // جلب أرصدة الإجازات
  const { data: leaveBalances = [] } = useQuery({
    queryKey: ["my-leave-balances", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
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
    enabled: !!authUser?.id,
  });

  // جلب قائمة الموظفين
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
  const { data: substituteRequests = [] } = useQuery({
    queryKey: ["pending-substitute-approvals", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
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
    enabled: !!authUser?.id,
  });

  // جلب الطلبات التي تمت الموافقة عليها كموظف بديل
  const { data: approvedAsSubstitute = [] } = useQuery({
    queryKey: ["approved-as-substitute", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("substitute_employee_id", authUser.id)
        .eq("substitute_approved", true)
        .order("substitute_approved_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id,
  });

  // جلب الطلبات التي تمت الموافقة عليها كمدير مباشر
  const { data: approvedAsManager = [] } = useQuery({
    queryKey: ["approved-as-manager", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("direct_manager_id", authUser.id)
        .eq("manager_approved", true)
        .order("manager_approved_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id,
  });

  // جلب الطلبات التي تحتاج موافقة كمدير مباشر
  const { data: managerRequests = [] } = useQuery({
    queryKey: ["pending-manager-approvals", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
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
    enabled: !!authUser?.id,
  });

  // جلب الطلبات التي تحتاج موافقة كمدير تنفيذي
  const { data: executiveRequests = [] } = useQuery({
    queryKey: ["pending-executive-approvals", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("executive_manager_id", authUser.id)
        .eq("executive_manager_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      return data;
    },
    enabled: !!authUser?.id,
  });

  const pendingApprovalsCount = substituteRequests.length + managerRequests.length + executiveRequests.length;
  const approvalsHistoryCount = approvedAsSubstitute.length + approvedAsManager.length;

  // موافقة كموظف بديل
  const substituteApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url, full_name")
        .eq("user_id", authUser?.id)
        .single();

      if (!employee?.signature_url) {
        throw new Error("يجب إضافة توقيعك في الملف الشخصي أولاً");
      }

      const { data: requestData } = await supabase
        .from("hr_requests")
        .select("user_id, request_number, hr_request_types(name_ar)")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("hr_requests")
        .update({
          substitute_approved: true,
          substitute_approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;

      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تمت موافقة الموظف البديل على ${requestTypeName}`,
          message: `وافق ${employee.full_name} على طلبك رقم ${requestData.request_number} كموظف بديل.`,
          type: "hr_request_approved",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["approved-as-substitute"] });
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
        .select("signature_url, full_name")
        .eq("user_id", authUser?.id)
        .single();

      if (!employee?.signature_url) {
        throw new Error("يجب إضافة توقيعك في الملف الشخصي أولاً");
      }

      const { data: requestData } = await supabase
        .from("hr_requests")
        .select("user_id, request_number, hr_request_types(name_ar)")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("hr_requests")
        .update({
          manager_approved: true,
          manager_approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;

      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تمت موافقة المدير المباشر على ${requestTypeName}`,
          message: `وافق ${employee.full_name} على طلبك رقم ${requestData.request_number} كمدير مباشر.`,
          type: "hr_request_approved",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-manager-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["approved-as-manager"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      toast.success("تمت موافقتك كمدير مباشر");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // موافقة كمدير تنفيذي
  const executiveApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url, full_name")
        .eq("user_id", authUser?.id)
        .single();

      if (!employee?.signature_url) {
        throw new Error("يجب إضافة توقيعك في الملف الشخصي أولاً");
      }

      const { data: requestData } = await supabase
        .from("hr_requests")
        .select("user_id, request_number, hr_request_types(name_ar, deducts_from_balance), days_count, request_type_id")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("hr_requests")
        .update({
          executive_manager_approved: true,
          executive_manager_approved_at: new Date().toISOString(),
          status: "approved",
          approved_by: authUser?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;

      // خصم من الرصيد إذا كان الطلب يخصم من الرصيد
      if (requestData && (requestData.hr_request_types as any)?.deducts_from_balance && requestData.days_count) {
        const { data: balance } = await supabase
          .from("hr_leave_balances")
          .select("*")
          .eq("user_id", requestData.user_id)
          .eq("request_type_id", requestData.request_type_id)
          .eq("year", new Date().getFullYear())
          .single();

        if (balance) {
          await supabase
            .from("hr_leave_balances")
            .update({
              used_days: (balance.used_days || 0) + requestData.days_count,
            })
            .eq("id", balance.id);
        }
      }

      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تمت الموافقة النهائية على ${requestTypeName}`,
          message: `تمت الموافقة على طلبك رقم ${requestData.request_number} بشكل نهائي.`,
          type: "hr_request_approved",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-executive-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      toast.success("تمت الموافقة النهائية على الطلب");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // رفض الطلب
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, reason, type }: { requestId: string; reason: string; type: 'substitute' | 'manager' | 'executive' }) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("full_name")
        .eq("user_id", authUser?.id)
        .single();

      const { data: requestData } = await supabase
        .from("hr_requests")
        .select("user_id, request_number, hr_request_types(name_ar)")
        .eq("id", requestId)
        .single();

      const { error } = await supabase
        .from("hr_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", requestId);
      
      if (error) throw error;

      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        const roleText = type === 'substitute' ? 'الموظف البديل' : type === 'manager' ? 'المدير المباشر' : 'المدير التنفيذي';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تم رفض ${requestTypeName}`,
          message: `رفض ${employee?.full_name || roleText} طلبك رقم ${requestData.request_number}. السبب: ${reason}`,
          type: "hr_request_rejected",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-manager-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-executive-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      toast.success("تم رفض الطلب");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenRejectDialog = (requestId: string, type: 'substitute' | 'manager' | 'executive') => {
    setRejectingRequest({ id: requestId, type });
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (rejectingRequest && rejectionReason.trim()) {
      rejectRequestMutation.mutate({
        requestId: rejectingRequest.id,
        reason: rejectionReason,
        type: rejectingRequest.type,
      });
      setRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectionReason("");
    }
  };

  const handlePreviewApproval = (request: any, type: "substitute" | "manager" | "executive") => {
    setPreviewRequest(request);
    setPreviewApprovalType(type);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">الموارد البشرية</h1>
            <p className="text-muted-foreground">إدارة الإجازات والاستئذانات والطلبات الإدارية</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => navigate("/hr-templates")}
                className="gap-2"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">إعدادات النماذج</span>
              </Button>
            )}
            <Button 
              onClick={() => setIsNewRequestOpen(true)}
              className="bg-gradient-to-r from-accent to-teal-500 hover:from-accent/90 hover:to-teal-500/90 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              طلب جديد
            </Button>
          </div>
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

        {/* الأيقونات الثلاثة */}
        <HRNavigationIcons
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          pendingApprovalsCount={pendingApprovalsCount}
          approvalsHistoryCount={approvalsHistoryCount}
        />

        {/* المحتوى حسب القسم المختار */}
        {activeSection === "my-requests" && (
          <MyRequestsSection
            requests={myRequests}
            isLoading={isLoadingRequests}
            onNewRequest={() => setIsNewRequestOpen(true)}
            onViewRequest={(request) => setSelectedRequest(request)}
            getRequestIcon={getRequestIcon}
          />
        )}

        {activeSection === "pending-approvals" && (
          <PendingApprovalsSection
            substituteRequests={substituteRequests}
            managerRequests={managerRequests}
            executiveRequests={executiveRequests}
            employees={employees}
            onApproveSubstitute={(id) => substituteApproveMutation.mutate(id)}
            onApproveManager={(id) => managerApproveMutation.mutate(id)}
            onApproveExecutive={(id) => executiveApproveMutation.mutate(id)}
            onReject={handleOpenRejectDialog}
            onPreview={handlePreviewApproval}
            isApprovingSubstitute={substituteApproveMutation.isPending}
            isApprovingManager={managerApproveMutation.isPending}
            isApprovingExecutive={executiveApproveMutation.isPending}
          />
        )}

        {activeSection === "my-approvals-history" && (
          <ApprovalsHistorySection
            approvedAsSubstitute={approvedAsSubstitute}
            approvedAsManager={approvedAsManager}
            employees={employees}
            onViewRequest={(request) => setSelectedRequest(request)}
            onNavigateToPending={() => handleSectionChange("pending-approvals")}
          />
        )}

        {/* إدارة طلبات الموظفين (للمدير فقط) */}
        {isAdmin && (
          <div className="pt-6 border-t">
            <AdminRequestsPanel requestTypes={requestTypes} />
          </div>
        )}

        {/* Dialog تقديم طلب جديد */}
        <NewRequestDialog
          open={isNewRequestOpen}
          onOpenChange={setIsNewRequestOpen}
          requestTypes={requestTypes}
          leaveBalances={leaveBalances}
          isAdmin={isAdmin}
          employees={employees}
        />

        {/* Dialog تفاصيل الطلب - للموظف صاحب الطلب */}
        <RequestPreviewDialog
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          viewMode="owner"
        />

        {/* Dialog استعراض الطلب للموافقة */}
        {previewRequest && (
          <RequestPreviewDialog
            request={previewRequest}
            open={!!previewRequest}
            onOpenChange={(open) => !open && setPreviewRequest(null)}
            viewMode="approver"
            approvalType={previewApprovalType === "executive" ? "manager" : previewApprovalType}
            onApprove={() => {
              if (previewApprovalType === "substitute") {
                substituteApproveMutation.mutate(previewRequest.id);
              } else if (previewApprovalType === "manager") {
                managerApproveMutation.mutate(previewRequest.id);
              } else {
                executiveApproveMutation.mutate(previewRequest.id);
              }
              setPreviewRequest(null);
            }}
            onReject={(reason) => {
              rejectRequestMutation.mutate({
                requestId: previewRequest.id,
                reason,
                type: previewApprovalType,
              });
              setPreviewRequest(null);
            }}
            isApproving={
              substituteApproveMutation.isPending ||
              managerApproveMutation.isPending ||
              executiveApproveMutation.isPending
            }
          />
        )}

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
