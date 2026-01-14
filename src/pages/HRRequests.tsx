import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Users,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { NewRequestDialog } from "@/components/hr/NewRequestDialog";
import { RequestPreviewDialog } from "@/components/hr/RequestPreviewDialog";
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

type EmployeeTab = "my-requests" | "pending-approvals" | "my-approvals-history";

export default function HRRequests() {
  const { user: authUser } = useAuth();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [previewRequest, setPreviewRequest] = useState<any>(null);
  const [previewApprovalType, setPreviewApprovalType] = useState<"substitute" | "manager">("substitute");
  const [adminActiveTab, setAdminActiveTab] = useState("requests");
  const [employeeActiveTab, setEmployeeActiveTab] = useState<EmployeeTab>("my-requests");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<{ id: string; type: 'substitute' | 'manager' | 'executive' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewExecutiveType, setPreviewExecutiveType] = useState<"substitute" | "manager" | "executive">("substitute");

  const isAdmin = user.role === "مدير النظام";

  const handleEmployeeTabChange = (value: string) => {
    if (value !== "my-requests" && value !== "pending-approvals" && value !== "my-approvals-history") return;

    const nextTab = value as EmployeeTab;
    setEmployeeActiveTab(nextTab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (isAdmin) return;

    const tab = searchParams.get("tab");
    if (!tab) return;

    if (tab === "my-requests" || tab === "pending-approvals" || tab === "my-approvals-history") {
      if (tab !== employeeActiveTab) setEmployeeActiveTab(tab);
    }
  }, [employeeActiveTab, isAdmin, searchParams]);

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

  // جلب الطلبات التي تحتاج موافقة كموظف بديل (معلقة)
  const { data: substituteRequests = [], isLoading: loadingSubstitute } = useQuery({
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

  // جلب الطلبات التي تمت الموافقة عليها كموظف بديل (سجل الموافقات)
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

  // جلب الطلبات التي تمت الموافقة عليها كمدير مباشر (سجل الموافقات)
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
  const { data: managerRequests = [], isLoading: loadingManager } = useQuery({
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
  const { data: executiveRequests = [], isLoading: loadingExecutive } = useQuery({
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

      // جلب بيانات الطلب
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

      // إرسال إشعار للموظف صاحب الطلب
      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تمت موافقة الموظف البديل على ${requestTypeName}`,
          message: `وافق ${employee.full_name} على طلبك رقم ${requestData.request_number} كموظف بديل. ينتظر الطلب الآن موافقة المدير المباشر.`,
          type: "hr_request_approved",
        });

        // إرسال نسخة لمدير الموارد البشرية (المديرين)
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (admins) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: `موافقة موظف بديل - ${requestTypeName}`,
              message: `وافق ${employee.full_name} كموظف بديل على الطلب رقم ${requestData.request_number}`,
              type: "hr_request_update",
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("تمت موافقتك كموظف بديل وتم إشعار الموظف");
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

      // جلب بيانات الطلب
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

      // إرسال إشعار للموظف صاحب الطلب
      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تمت موافقة المدير المباشر على ${requestTypeName}`,
          message: `وافق ${employee.full_name} على طلبك رقم ${requestData.request_number} كمدير مباشر. ينتظر الطلب الآن موافقة المدير التنفيذي.`,
          type: "hr_request_approved",
        });

        // إرسال نسخة لمدير الموارد البشرية (المديرين)
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (admins) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: `موافقة مدير مباشر - ${requestTypeName}`,
              message: `وافق ${employee.full_name} كمدير مباشر على الطلب رقم ${requestData.request_number}`,
              type: "hr_request_update",
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-manager-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("تمت موافقتك كمدير مباشر وتم إشعار الموظف");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // موافقة كمدير تنفيذي (الموافقة النهائية)
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

      // جلب بيانات الطلب
      const { data: requestData } = await supabase
        .from("hr_requests")
        .select("user_id, request_number, hr_request_types(name_ar, deducts_from_balance), days_count, request_type_id")
        .eq("id", requestId)
        .single();

      // تحديث الطلب كمعتمد نهائياً
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

      // إرسال إشعار للموظف صاحب الطلب - الموافقة النهائية
      if (requestData) {
        const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';
        await supabase.from("notifications").insert({
          user_id: requestData.user_id,
          title: `تمت الموافقة النهائية على ${requestTypeName}`,
          message: `تهانينا! تمت الموافقة على طلبك رقم ${requestData.request_number} من قبل المدير التنفيذي ${employee.full_name}.`,
          type: "hr_request_final_approved",
        });

        // إرسال نسخة لمدير الموارد البشرية (المديرين)
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (admins) {
          for (const admin of admins) {
            await supabase.from("notifications").insert({
              user_id: admin.user_id,
              title: `موافقة نهائية - ${requestTypeName}`,
              message: `تمت الموافقة النهائية على الطلب رقم ${requestData.request_number} من قبل المدير التنفيذي ${employee.full_name}`,
              type: "hr_request_final_approved",
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-executive-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      toast.success("تمت الموافقة النهائية وتم إشعار الموظف ومدير الموارد البشرية");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // رفض الطلب (كموظف بديل أو مدير مباشر أو مدير تنفيذي)
  const rejectRequestMutation = useMutation({
    mutationFn: async ({ requestId, reason, type }: { requestId: string; reason: string; type: 'substitute' | 'manager' | 'executive' }) => {
      // جلب بيانات الطلب أولاً للحصول على user_id صاحب الطلب ورقم الطلب
      const { data: requestData, error: fetchError } = await supabase
        .from("hr_requests")
        .select("user_id, request_number, hr_request_types(name_ar)")
        .eq("id", requestId)
        .single();
      
      if (fetchError) throw fetchError;

      // تحديث حالة الطلب
      const { error } = await supabase
        .from("hr_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", requestId);
      
      if (error) throw error;

      // جلب اسم الموظف الذي رفض الطلب
      const { data: rejecterEmployee } = await supabase
        .from("employees")
        .select("full_name")
        .eq("user_id", authUser?.id)
        .single();

      const rejecterName = rejecterEmployee?.full_name || (type === 'substitute' ? 'الموظف البديل' : type === 'manager' ? 'المدير المباشر' : 'المدير التنفيذي');
      const requestTypeName = (requestData.hr_request_types as any)?.name_ar || 'طلب';

      // إرسال إشعار للموظف صاحب الطلب
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: requestData.user_id,
          title: `تم رفض ${requestTypeName}`,
          message: `تم رفض طلبك رقم ${requestData.request_number} من قبل ${rejecterName}. السبب: ${reason}`,
          type: "hr_request_rejected",
        });

      if (notificationError) {
        console.error("Error sending notification:", notificationError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-manager-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-executive-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      toast.success("تم رفض الطلب وإرسال إشعار للموظف");
      setRejectDialogOpen(false);
      setRejectingRequest(null);
      setRejectionReason("");
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

  const pendingApprovalsCount = (substituteRequests?.length || 0) + (managerRequests?.length || 0) + (executiveRequests?.length || 0);

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
              {(substituteRequests.length > 0 || managerRequests.length > 0 || executiveRequests.length > 0) && (
                <button
                  onClick={() => setAdminActiveTab("pending-approvals")}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all relative ${
                    adminActiveTab === "pending-approvals"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
                      : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                  موافقات معلقة
                  <Badge variant="destructive" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">
                    {substituteRequests.length + managerRequests.length + executiveRequests.length}
                  </Badge>
                </button>
              )}
              {approvedAsSubstitute.length > 0 && (
                <button
                  onClick={() => setAdminActiveTab("my-approvals-substitute")}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all ${
                    adminActiveTab === "my-approvals-substitute"
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md"
                      : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  موافقاتي كبديل
                  <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs bg-emerald-100 text-emerald-700">
                    {approvedAsSubstitute.length}
                  </Badge>
                </button>
              )}
              {approvedAsManager.length > 0 && (
                <button
                  onClick={() => setAdminActiveTab("my-approvals-manager")}
                  className={`flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all ${
                    adminActiveTab === "my-approvals-manager"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                      : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                  موافقاتي كمدير
                  <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs bg-blue-100 text-blue-700">
                    {approvedAsManager.length}
                  </Badge>
                </button>
              )}
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
          ) : adminActiveTab === "pending-approvals" ? (
            <div className="space-y-6">
              {/* كموظف بديل */}
              {substituteRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-amber-600" />
                      موافقتك كموظف بديل
                      <Badge variant="secondary">{substituteRequests.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {substituteRequests.map((request: any) => {
                        const requester = employees.find((emp: any) => emp.user_id === request.user_id);
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
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPreviewRequest(request);
                                  setPreviewApprovalType("substitute");
                                }}
                                className="border-primary text-primary hover:bg-primary/10"
                              >
                                <Eye className="w-4 h-4 ml-1" />
                                استعراض
                              </Button>
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
                      <Badge variant="secondary">{managerRequests.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {managerRequests.map((request: any) => {
                        const requester = employees.find((emp: any) => emp.user_id === request.user_id);
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
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPreviewRequest(request);
                                  setPreviewApprovalType("manager");
                                }}
                                className="border-primary text-primary hover:bg-primary/10"
                              >
                                <Eye className="w-4 h-4 ml-1" />
                                استعراض
                              </Button>
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
                  </CardContent>
                </Card>
              )}

              {/* كمدير تنفيذي */}
              {executiveRequests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-purple-600" />
                      موافقتك كمدير تنفيذي
                      <Badge variant="secondary">{executiveRequests.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {executiveRequests.map((request: any) => {
                        const requester = employees.find((emp: any) => emp.user_id === request.user_id);
                        return (
                          <div key={request.id} className="flex items-center gap-4 p-4 rounded-xl border bg-purple-50/50 border-purple-200">
                            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-purple-300">
                              {requester?.avatar_url ? (
                                <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-purple-400 flex items-center justify-center text-white font-bold">
                                  {requester?.full_name?.charAt(0) || "؟"}
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">{requester?.full_name || "موظف"}</div>
                              <div className="text-sm text-muted-foreground">
                                {request.hr_request_types?.name_ar} • {request.request_number}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => executiveApproveMutation.mutate(request.id)}
                                disabled={executiveApproveMutation.isPending}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {executiveApproveMutation.isPending ? (
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
                                onClick={() => handleOpenRejectDialog(request.id, 'executive')}
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
                  </CardContent>
                </Card>
              )}
            </div>
          ) : adminActiveTab === "my-approvals-substitute" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  الطلبات التي وافقت عليها كموظف بديل
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{approvedAsSubstitute.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvedAsSubstitute.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا توجد موافقات سابقة</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {approvedAsSubstitute.map((request: any) => {
                      const requester = employees.find((emp: any) => emp.user_id === request.user_id);
                      const StatusIcon = statusConfig[request.status as keyof typeof statusConfig]?.icon || AlertCircle;
                      return (
                        <div 
                          key={request.id} 
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                            request.status === 'approved' 
                              ? 'bg-emerald-50/50 border-emerald-200' 
                              : request.status === 'rejected'
                              ? 'bg-red-50/50 border-red-200'
                              : 'bg-amber-50/50 border-amber-200'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-300">
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-emerald-400 flex items-center justify-center text-white font-bold">
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">{requester?.full_name || "موظف"}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.hr_request_types?.name_ar} • {request.request_number}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              وافقت بتاريخ: {request.substitute_approved_at ? format(new Date(request.substitute_approved_at), "yyyy/MM/dd - HH:mm", { locale: ar }) : "-"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={statusConfig[request.status as keyof typeof statusConfig]?.color || "bg-muted"}>
                              <StatusIcon className="w-3 h-3 ml-1" />
                              {statusConfig[request.status as keyof typeof statusConfig]?.label || request.status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewRequest(request);
                                setPreviewApprovalType("substitute");
                              }}
                              className="border-primary text-primary hover:bg-primary/10"
                            >
                              <Eye className="w-4 h-4 ml-1" />
                              عرض
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : adminActiveTab === "my-approvals-manager" ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  الطلبات التي وافقت عليها كمدير مباشر
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">{approvedAsManager.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvedAsManager.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>لا توجد موافقات سابقة</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {approvedAsManager.map((request: any) => {
                      const requester = employees.find((emp: any) => emp.user_id === request.user_id);
                      const StatusIcon = statusConfig[request.status as keyof typeof statusConfig]?.icon || AlertCircle;
                      return (
                        <div 
                          key={request.id} 
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                            request.status === 'approved' 
                              ? 'bg-blue-50/50 border-blue-200' 
                              : request.status === 'rejected'
                              ? 'bg-red-50/50 border-red-200'
                              : 'bg-amber-50/50 border-amber-200'
                          }`}
                        >
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
                            <div className="text-xs text-muted-foreground mt-1">
                              وافقت بتاريخ: {request.manager_approved_at ? format(new Date(request.manager_approved_at), "yyyy/MM/dd - HH:mm", { locale: ar }) : "-"}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={statusConfig[request.status as keyof typeof statusConfig]?.color || "bg-muted"}>
                              <StatusIcon className="w-3 h-3 ml-1" />
                              {statusConfig[request.status as keyof typeof statusConfig]?.label || request.status}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreviewRequest(request);
                                setPreviewApprovalType("manager");
                              }}
                              className="border-primary text-primary hover:bg-primary/10"
                            >
                              <Eye className="w-4 h-4 ml-1" />
                              عرض
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
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

          {/* Preview Dialog للموافقات */}
          {previewRequest && (
            <RequestPreviewDialog
              request={previewRequest}
              open={!!previewRequest}
              onOpenChange={(open) => !open && setPreviewRequest(null)}
              viewMode="approver"
              approvalType={previewApprovalType}
              onApprove={() => {
                if (previewApprovalType === "substitute") {
                  substituteApproveMutation.mutate(previewRequest.id);
                } else {
                  managerApproveMutation.mutate(previewRequest.id);
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
              isApproving={substituteApproveMutation.isPending || managerApproveMutation.isPending}
            />
          )}

          {/* Reject Dialog */}
          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>رفض الطلب</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  placeholder="سبب الرفض..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (rejectingRequest && rejectionReason.trim()) {
                        rejectRequestMutation.mutate({
                          requestId: rejectingRequest.id,
                          reason: rejectionReason,
                          type: rejectingRequest.type,
                        });
                        setRejectDialogOpen(false);
                        setRejectionReason("");
                        setRejectingRequest(null);
                      }
                    }}
                    disabled={!rejectionReason.trim() || rejectRequestMutation.isPending}
                  >
                    {rejectRequestMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    ) : null}
                    تأكيد الرفض
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
        <Tabs value={employeeActiveTab} onValueChange={handleEmployeeTabChange} dir="rtl">
          <TabsList className="flex w-full gap-2 overflow-x-auto h-auto justify-start sm:justify-center">
            <TabsTrigger value="my-requests" className="gap-2 text-xs sm:text-sm py-2 px-3 flex-none">
              <ClipboardList className="w-4 h-4" />
              <span>طلباتي</span>
            </TabsTrigger>
            <TabsTrigger value="pending-approvals" className="gap-2 text-xs sm:text-sm py-2 px-3 flex-none relative">
              <UserCheck className="w-4 h-4" />
              <span>موافقات معلقة</span>
              {pendingApprovalsCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -left-1 sm:relative sm:top-0 sm:left-0 sm:mr-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingApprovalsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-approvals-history" className="gap-2 text-xs sm:text-sm py-2 px-3 flex-none relative">
              <CheckCircle2 className="w-4 h-4" />
              <span>سجل موافقاتي</span>
              {(approvedAsSubstitute.length + approvedAsManager.length) > 0 && (
                <Badge variant="secondary" className="absolute -top-1 -left-1 sm:relative sm:top-0 sm:left-0 sm:mr-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs bg-green-100 text-green-700">
                  {approvedAsSubstitute.length + approvedAsManager.length}
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
                          className="flex items-center gap-4 p-4 rounded-xl border hover:shadow-md transition-shadow"
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
                          <div className="flex items-center gap-3">
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(request.created_at), "d MMM yyyy", { locale: ar })}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRequest(request)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              استعراض
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
                              variant="outline"
                              onClick={() => {
                                setPreviewRequest(request);
                                setPreviewApprovalType("substitute");
                              }}
                              className="border-primary text-primary hover:bg-primary/10"
                            >
                              <Eye className="w-4 h-4 ml-1" />
                              استعراض
                            </Button>
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
                              variant="outline"
                              onClick={() => {
                                setPreviewRequest(request);
                                setPreviewApprovalType("manager");
                              }}
                              className="border-primary text-primary hover:bg-primary/10"
                            >
                              <Eye className="w-4 h-4 ml-1" />
                              استعراض
                            </Button>
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

          {/* سجل موافقاتي */}
          <TabsContent value="my-approvals-history" className="mt-4 space-y-6">
            {/* موافقاتي كموظف بديل */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  موافقاتي كموظف بديل
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{approvedAsSubstitute.length}</Badge>
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
                      const requester = employees.find((emp: any) => emp.user_id === request.user_id);
                      const isApproved = request.status === 'approved';
                      const isRejected = request.status === 'rejected';
                      return (
                        <div 
                          key={request.id} 
                          className={`flex items-center gap-4 p-4 rounded-xl border ${
                            isApproved ? 'bg-green-50/50 border-green-200' : 
                            isRejected ? 'bg-red-50/50 border-red-200' : 
                            'bg-amber-50/50 border-amber-200'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${
                            isApproved ? 'border-green-300' : 
                            isRejected ? 'border-red-300' : 
                            'border-amber-300'
                          }`}>
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-white font-bold ${
                                isApproved ? 'bg-green-400' : 
                                isRejected ? 'bg-red-400' : 
                                'bg-amber-400'
                              }`}>
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{requester?.full_name || "موظف"}</span>
                              <Badge variant="outline" className={`text-xs ${
                                isApproved ? 'border-green-300 text-green-700 bg-green-50' : 
                                isRejected ? 'border-red-300 text-red-700 bg-red-50' : 
                                'border-amber-300 text-amber-700 bg-amber-50'
                              }`}>
                                {isApproved ? 'تمت الموافقة النهائية' : isRejected ? 'مرفوض' : 'قيد المعالجة'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
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
                            onClick={() => setSelectedRequest(request)}
                            className="border-primary text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            استعراض
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
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700">{approvedAsManager.length}</Badge>
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
                      const requester = employees.find((emp: any) => emp.user_id === request.user_id);
                      const isApproved = request.status === 'approved';
                      const isRejected = request.status === 'rejected';
                      return (
                        <div 
                          key={request.id} 
                          className={`flex items-center gap-4 p-4 rounded-xl border ${
                            isApproved ? 'bg-green-50/50 border-green-200' : 
                            isRejected ? 'bg-red-50/50 border-red-200' : 
                            'bg-blue-50/50 border-blue-200'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full overflow-hidden border-2 ${
                            isApproved ? 'border-green-300' : 
                            isRejected ? 'border-red-300' : 
                            'border-blue-300'
                          }`}>
                            {requester?.avatar_url ? (
                              <img src={requester.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center text-white font-bold ${
                                isApproved ? 'bg-green-400' : 
                                isRejected ? 'bg-red-400' : 
                                'bg-blue-400'
                              }`}>
                                {requester?.full_name?.charAt(0) || "؟"}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{requester?.full_name || "موظف"}</span>
                              <Badge variant="outline" className={`text-xs ${
                                isApproved ? 'border-green-300 text-green-700 bg-green-50' : 
                                isRejected ? 'border-red-300 text-red-700 bg-red-50' : 
                                'border-blue-300 text-blue-700 bg-blue-50'
                              }`}>
                                {isApproved ? 'تمت الموافقة النهائية' : isRejected ? 'مرفوض' : 'قيد المعالجة'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
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
                            onClick={() => setSelectedRequest(request)}
                            className="border-primary text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-4 h-4 ml-1" />
                            استعراض
                          </Button>
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

        {/* Dialog تفاصيل الطلب - للموظف صاحب الطلب */}
        <RequestPreviewDialog
          request={selectedRequest}
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          viewMode="owner"
        />

        {/* Dialog استعراض الطلب للموافقة - للمدير أو الموظف البديل */}
        <RequestPreviewDialog
          request={previewRequest}
          open={!!previewRequest}
          onOpenChange={(open) => !open && setPreviewRequest(null)}
          viewMode="approver"
          approvalType={previewApprovalType}
          onApprove={() => {
            if (previewApprovalType === "substitute") {
              substituteApproveMutation.mutate(previewRequest.id);
            } else {
              managerApproveMutation.mutate(previewRequest.id);
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
          isApproving={substituteApproveMutation.isPending || managerApproveMutation.isPending}
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
