import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Download,
  User,
  Printer,
  UserCheck,
  Users,
  Trash2,
  MessageSquare,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import { OfficialRequestPDF } from "./OfficialRequestPDF";
import { LiveRequestPreview } from "./LiveRequestPreview";

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle },
  approved: { label: "موافق عليه", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

interface RequestDetailsDialogProps {
  request: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function RequestDetailsDialog({ 
  request, 
  open, 
  onOpenChange,
  isAdmin = false 
}: RequestDetailsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  // جلب بيانات الموظف صاحب الطلب
  const { data: employeeData } = useQuery({
    queryKey: ["employee-for-request", request?.user_id],
    queryFn: async () => {
      if (!request?.user_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url, title")
        .eq("user_id", request.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.user_id,
  });

  // جلب بيانات الموافق
  const { data: approverData } = useQuery({
    queryKey: ["approver-for-request", request?.approved_by],
    queryFn: async () => {
      if (!request?.approved_by) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url")
        .eq("user_id", request.approved_by)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.approved_by,
  });

  // جلب بيانات الموظف البديل
  const { data: substituteData } = useQuery({
    queryKey: ["substitute-for-request", request?.substitute_employee_id],
    queryFn: async () => {
      if (!request?.substitute_employee_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url")
        .eq("user_id", request.substitute_employee_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.substitute_employee_id,
  });

  // جلب بيانات المدير المباشر
  const { data: managerData } = useQuery({
    queryKey: ["manager-for-request", request?.direct_manager_id],
    queryFn: async () => {
      if (!request?.direct_manager_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url")
        .eq("user_id", request.direct_manager_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.direct_manager_id,
  });

  // جلب بيانات مدير الموارد البشرية
  const { data: hrManagerData } = useQuery({
    queryKey: ["hr-manager-for-request", request?.hr_manager_id],
    queryFn: async () => {
      if (!request?.hr_manager_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url")
        .eq("user_id", request.hr_manager_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.hr_manager_id,
  });

  // جلب بيانات المدير التنفيذي
  const { data: executiveManagerData } = useQuery({
    queryKey: ["executive-manager-for-request", request?.executive_manager_id],
    queryFn: async () => {
      if (!request?.executive_manager_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url")
        .eq("user_id", request.executive_manager_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.executive_manager_id,
  });

  // التحقق إذا كان المستخدم الحالي هو البديل أو المدير
  const isSubstitute = user?.id === request?.substitute_employee_id;
  const isManager = user?.id === request?.direct_manager_id;
  const canApproveAsSubstitute = isSubstitute && !request?.substitute_approved;
  const canApproveAsManager = isManager && !request?.manager_approved;

  const updateRequestMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason?: string }) => {
      const updates: any = {
        status,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };

      if (reason) {
        updates.rejection_reason = reason;
      }

      const { error } = await supabase
        .from("hr_requests")
        .update(updates)
        .eq("id", request.id);

      if (error) throw error;

      if (status === "approved" && request.hr_request_types?.deducts_from_balance && request.days_count) {
        const { data: balance } = await supabase
          .from("hr_leave_balances")
          .select("*")
          .eq("user_id", request.user_id)
          .eq("request_type_id", request.request_type_id)
          .eq("year", new Date().getFullYear())
          .single();

        if (balance) {
          await supabase
            .from("hr_leave_balances")
            .update({ used_days: balance.used_days + request.days_count })
            .eq("id", balance.id);
        }
      }

      await supabase
        .from("hr_request_approvals")
        .insert({
          request_id: request.id,
          approver_id: user?.id,
          action: status,
          comments: reason || null,
        });

      const notificationTitle = status === "approved" 
        ? "تمت الموافقة على طلبك" 
        : "تم رفض طلبك";
      
      const notificationMessage = status === "approved"
        ? `تمت الموافقة على طلب ${request.hr_request_types?.name_ar} رقم ${request.request_number}`
        : `تم رفض طلب ${request.hr_request_types?.name_ar} رقم ${request.request_number}${reason ? `. السبب: ${reason}` : ""}`;

      await supabase
        .from("notifications")
        .insert({
          user_id: request.user_id,
          title: notificationTitle,
          message: notificationMessage,
          type: status === "approved" ? "success" : "error",
        });
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "تمت الموافقة على الطلب" : "تم رفض الطلب");
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error updating request:", error);
      toast.error("حدث خطأ أثناء تحديث الطلب");
    },
  });

  const substituteApproveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hr_requests")
        .update({
          substitute_approved: true,
          substitute_approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت موافقتك كموظف بديل");
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-substitute-requests"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error approving as substitute:", error);
      toast.error("حدث خطأ");
    },
  });

  const managerApproveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hr_requests")
        .update({
          manager_approved: true,
          manager_approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت موافقتك كمدير مباشر");
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error approving as manager:", error);
      toast.error("حدث خطأ");
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hr_requests")
        .delete()
        .eq("id", request.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error deleting request:", error);
      toast.error("حدث خطأ أثناء حذف الطلب");
    },
  });

  const handleApprove = () => {
    updateRequestMutation.mutate({ status: "approved" });
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast.error("يرجى إدخال سبب الرفض");
      return;
    }
    updateRequestMutation.mutate({ status: "rejected", reason: rejectionReason });
  };

  const handleDelete = () => {
    if (window.confirm("هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteRequestMutation.mutate();
    }
  };

  if (!request) return null;

  const statusInfo = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  // إنشاء قائمة الموافقات
  const approvalsList = [
    {
      id: "substitute",
      label: "الموظف البديل",
      name: substituteData?.full_name,
      avatar: substituteData?.avatar_url,
      approved: request.substitute_approved,
      show: !!request.substitute_employee_id,
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-600",
      canApprove: canApproveAsSubstitute,
      onApprove: () => substituteApproveMutation.mutate(),
      isPending: substituteApproveMutation.isPending,
    },
    {
      id: "manager",
      label: "المدير المباشر",
      name: managerData?.full_name,
      avatar: managerData?.avatar_url,
      approved: request.manager_approved,
      show: !!request.direct_manager_id,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-600",
      canApprove: canApproveAsManager,
      onApprove: () => managerApproveMutation.mutate(),
      isPending: managerApproveMutation.isPending,
    },
    {
      id: "hr_manager",
      label: "مدير الموارد البشرية",
      name: hrManagerData?.full_name,
      avatar: hrManagerData?.avatar_url,
      approved: request.hr_manager_approved,
      show: !!request.hr_manager_id,
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      textColor: "text-purple-600",
      canApprove: false,
      onApprove: () => {},
      isPending: false,
    },
    {
      id: "executive_manager",
      label: "المدير التنفيذي",
      name: executiveManagerData?.full_name,
      avatar: executiveManagerData?.avatar_url,
      approved: request.executive_manager_approved,
      show: !!request.executive_manager_id,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-600",
      canApprove: false,
      onApprove: () => {},
      isPending: false,
    },
  ].filter(a => a.show);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* القسم الأيسر: التفاصيل */}
          <div className="p-4 space-y-4 border-l border-border/50">
            {/* مقدم الطلب - مصغر */}
            <div className="flex items-center justify-end gap-3 p-3 bg-gradient-to-l from-primary/10 to-accent/5 rounded-xl">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">مقدم الطلب</p>
                <p className="font-semibold text-sm">{employeeData?.full_name || "---"}</p>
                <p className="text-xs text-muted-foreground">{employeeData?.job_role}</p>
              </div>
              <Avatar className="w-12 h-12 border-2 border-primary/20">
                <AvatarImage src={employeeData?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {employeeData?.full_name?.charAt(0) || "؟"}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* التواريخ - صف واحد */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                <span className="font-medium text-sm">
                  {request.start_date ? format(new Date(request.start_date), "d MMMM yyyy", { locale: ar }) : "---"}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>من تاريخ</span>
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                <span className="font-medium text-sm">
                  {request.end_date ? format(new Date(request.end_date), "d MMMM yyyy", { locale: ar }) : "---"}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>إلى تاريخ</span>
                  <Calendar className="w-4 h-4 text-accent" />
                </div>
              </div>
            </div>

            {/* تاريخ التقديم والمدة */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                <span className="font-medium text-sm">
                  {format(new Date(request.created_at), "d MMMM yyyy", { locale: ar })}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>تاريخ التقديم</span>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  {request.days_count || 0} يوم
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>المدة</span>
                  <ClipboardList className="w-4 h-4 text-amber-500" />
                </div>
              </div>
            </div>

            {/* السبب والملاحظات - مدمجة */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                <p className="text-sm flex-1 text-right">{request.reason || "---"}</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mr-3">
                  <span>سبب الطلب</span>
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
              </div>
              {request.notes && (
                <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                  <p className="text-sm flex-1 text-right">{request.notes}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mr-3">
                    <span>ملاحظات</span>
                    <FileText className="w-4 h-4 text-accent" />
                  </div>
                </div>
              )}
            </div>

            {/* حالة الموافقات */}
            {approvalsList.length > 0 && (
              <div className="bg-muted/20 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <span className="text-sm font-semibold">حالة الموافقات</span>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
                
                {approvalsList.map((approval) => (
                  <div 
                    key={approval.id}
                    className={`flex items-center justify-between p-2.5 ${approval.bgColor} rounded-lg border ${approval.borderColor}`}
                  >
                    {approval.approved ? (
                      <Badge className="bg-green-100 text-green-700 gap-1 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        تمت الموافقة
                      </Badge>
                    ) : approval.canApprove ? (
                      <Button
                        size="sm"
                        onClick={approval.onApprove}
                        disabled={approval.isPending}
                        className={`h-7 text-xs ${approval.id === 'substitute' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {approval.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            موافقة
                          </>
                        )}
                      </Button>
                    ) : (
                      <Badge variant="outline" className={`${approval.textColor} border-current text-xs`}>
                        في الانتظار
                      </Badge>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`text-xs font-medium ${approval.textColor}`}>{approval.label}</p>
                        <p className="text-xs text-muted-foreground">{approval.name || "---"}</p>
                      </div>
                      <Avatar className="w-8 h-8 border border-current/20">
                        <AvatarImage src={approval.avatar || undefined} />
                        <AvatarFallback className={`${approval.bgColor} ${approval.textColor} text-xs`}>
                          {approval.name?.charAt(0) || "؟"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* سبب الرفض */}
            {request.status === "rejected" && request.rejection_reason && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex-1 text-right">
                  <p className="text-xs font-medium text-destructive mb-1">سبب الرفض</p>
                  <p className="text-sm">{request.rejection_reason}</p>
                </div>
                <XCircle className="w-5 h-5 text-destructive shrink-0" />
              </div>
            )}

            {/* المرفق */}
            {request.attachment_url && (
              <a 
                href={request.attachment_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{request.attachment_name || "مرفق"}</span>
                <FileText className="w-4 h-4 text-accent" />
              </a>
            )}

            {/* أزرار الإجراءات */}
            <div className="space-y-2 pt-2">
              {request.status === "approved" && employeeData && (
                <Button
                  onClick={() => setShowPDFPreview(true)}
                  size="sm"
                  className="w-full bg-gradient-to-r from-accent to-teal-500"
                >
                  <Printer className="w-4 h-4 ml-2" />
                  طباعة الطلب الرسمي
                </Button>
              )}

              {isAdmin && request.status === "pending" && (
                <>
                  {showRejectionForm ? (
                    <div className="space-y-2">
                      <Label className="text-xs">سبب الرفض</Label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="اكتب سبب رفض الطلب..."
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRejectionForm(false)}
                          className="flex-1"
                        >
                          إلغاء
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleReject}
                          disabled={updateRequestMutation.isPending}
                          className="flex-1"
                        >
                          {updateRequestMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "تأكيد الرفض"
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRejectionForm(true)}
                        className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-4 h-4 ml-1" />
                        رفض
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApprove}
                        disabled={updateRequestMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {updateRequestMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            موافقة
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteRequestMutation.isPending}
                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                >
                  {deleteRequestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 ml-1" />
                      حذف الطلب
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* القسم الأيمن: معاينة النموذج */}
          {employeeData && (
            <div className="p-4 bg-muted/20">
              <div className="flex items-center justify-end gap-2 text-xs font-medium text-muted-foreground mb-3">
                <span>معاينة النموذج الرسمي</span>
                <FileText className="w-4 h-4" />
              </div>
              <LiveRequestPreview
                employeeName={employeeData.full_name}
                jobRole={employeeData.job_role}
                signatureUrl={employeeData.signature_url}
                requestTypeName={request.hr_request_types?.name_ar || "طلب"}
                startDate={request.start_date ? new Date(request.start_date) : undefined}
                endDate={request.end_date ? new Date(request.end_date) : undefined}
                daysCount={request.days_count || 0}
                reason={request.reason || ""}
                notes={request.notes || ""}
                requestNumber={request.request_number}
                substituteEmployee={substituteData?.full_name}
                substituteSignatureUrl={substituteData?.signature_url}
                substituteApproved={request.substitute_approved}
                directManager={managerData?.full_name}
                directManagerSignatureUrl={managerData?.signature_url}
                managerApproved={request.manager_approved}
                hrManager={hrManagerData?.full_name}
                hrManagerSignatureUrl={hrManagerData?.signature_url}
                hrManagerApproved={request.hr_manager_approved}
                executiveManager={executiveManagerData?.full_name}
                executiveManagerSignatureUrl={executiveManagerData?.signature_url}
                executiveManagerApproved={request.executive_manager_approved}
                approverName={approverData?.full_name}
                approverSignatureUrl={approverData?.signature_url}
                isApproved={request.status === "approved"}
                headerOffset={request.hr_request_types?.header_offset ?? 35}
                letterheadUrl={request.hr_request_types?.letterhead_url}
              />
            </div>
          )}
        </div>
      </DialogContent>

      {employeeData && (
        <OfficialRequestPDF
          open={showPDFPreview}
          onOpenChange={setShowPDFPreview}
          request={request}
          employee={employeeData}
          approver={approverData}
          substituteEmployee={substituteData}
          substituteApproved={request.substitute_approved}
          directManager={managerData}
          managerApproved={request.manager_approved}
        />
      )}
    </Dialog>
  );
}
