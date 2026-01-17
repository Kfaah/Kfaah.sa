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
import { 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Download,
  User,
  UserCheck,
  Users,
  Trash2,
  CalendarDays,
  MessageSquare,
  Printer,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LiveRequestPreview } from "./LiveRequestPreview";
import { WorkflowTimeline } from "./WorkflowTimeline";
import jsPDF from "jspdf";

const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; iconBg: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { 
    label: "قيد المراجعة", 
    color: "text-amber-800", 
    bgColor: "bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50", 
    borderColor: "border-amber-200/50",
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    icon: Clock 
  },
  approved: { 
    label: "موافق عليه", 
    color: "text-emerald-800", 
    bgColor: "bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50", 
    borderColor: "border-emerald-200/50",
    iconBg: "bg-gradient-to-br from-emerald-400 to-green-500",
    icon: CheckCircle2 
  },
  rejected: { 
    label: "مرفوض", 
    color: "text-red-800", 
    bgColor: "bg-gradient-to-br from-red-50 via-rose-50 to-pink-50", 
    borderColor: "border-red-200/50",
    iconBg: "bg-gradient-to-br from-red-400 to-rose-500",
    icon: XCircle 
  },
};

interface RequestPreviewDialogProps {
  request: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewMode?: "owner" | "approver" | "admin";
  approvalType?: "substitute" | "manager" | "admin" | "executive";
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  isApproving?: boolean;
}

export function RequestPreviewDialog({ 
  request, 
  open, 
  onOpenChange,
  viewMode = "owner",
  approvalType,
  onApprove,
  onReject,
  isApproving = false
}: RequestPreviewDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showApprovalsDetails, setShowApprovalsDetails] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // جلب بيانات الموظف صاحب الطلب
  const { data: employeeData } = useQuery({
    queryKey: ["employee-for-request", request?.user_id],
    queryFn: async () => {
      if (!request?.user_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url, avatar_url")
        .eq("user_id", request.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.user_id && open,
  });

  // جلب بيانات الموافق
  const { data: approverData } = useQuery({
    queryKey: ["approver-for-request", request?.approved_by],
    queryFn: async () => {
      if (!request?.approved_by) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("user_id", request.approved_by)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.approved_by && open,
  });

  // جلب بيانات الموظف البديل
  const { data: substituteData } = useQuery({
    queryKey: ["substitute-for-request", request?.substitute_employee_id],
    queryFn: async () => {
      if (!request?.substitute_employee_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("user_id", request.substitute_employee_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.substitute_employee_id && open,
  });

  // جلب بيانات المدير المباشر
  const { data: managerData } = useQuery({
    queryKey: ["manager-for-request", request?.direct_manager_id],
    queryFn: async () => {
      if (!request?.direct_manager_id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("user_id", request.direct_manager_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.direct_manager_id && open,
  });

  // جلب بيانات مدير الموارد البشرية (دائماً)
  const { data: hrManagerData } = useQuery({
    queryKey: ["hr-manager-global"],
    queryFn: async () => {
      const { data: hrManagerId, error: fnError } = await supabase.rpc("get_hr_manager_id");
      if (fnError || !hrManagerId) return null;

      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("user_id", hrManagerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // جلب بيانات المدير التنفيذي (من الطلب إن وُجد، وإلا من هيكل الموظف)
  const { data: executiveManagerData } = useQuery({
    queryKey: ["executive-manager-for-request", request?.id],
    queryFn: async () => {
      if (!request?.user_id) return null;

      const executiveUserId = request.executive_manager_id as string | null;

      // إذا كان محفوظاً في الطلب
      if (executiveUserId) {
        const { data, error } = await supabase
          .from("employees")
          .select("full_name, job_role, signature_url")
          .eq("user_id", executiveUserId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }

      // وإلا نحاول جلبه من الموظف صاحب الطلب (executive_manager_id هو employees.id وليس user_id)
      const { data: emp, error: empError } = await supabase
        .from("employees")
        .select("executive_manager_id")
        .eq("user_id", request.user_id)
        .maybeSingle();

      if (empError || !emp?.executive_manager_id) return null;

      // نجلب بيانات المدير التنفيذي عبر employees.id
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("id", emp.executive_manager_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.user_id && open,
  });

  const isAdminView = viewMode === "admin";

  // اعتماد/رفض الطلب (اعتماد الإدارة النهائي)
  const adminUpdateMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: "approved" | "rejected"; reason?: string }) => {
      const updates: any = {
        status,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };

      if (reason) updates.rejection_reason = reason;

      const { error } = await supabase
        .from("hr_requests")
        .update(updates)
        .eq("id", request.id);

      if (error) throw error;

      // إذا تمت الموافقة وكان الطلب يخصم من الرصيد
      if (
        status === "approved" &&
        request.hr_request_types?.deducts_from_balance &&
        request.days_count
      ) {
        const { data: balance, error: balanceError } = await supabase
          .from("hr_leave_balances")
          .select("*")
          .eq("user_id", request.user_id)
          .eq("request_type_id", request.request_type_id)
          .eq("year", new Date().getFullYear())
          .single();

        // إذا لم يوجد سجل رصيد، نتجاهل (قد لا يكون مُهيأ)
        if (!balanceError && balance) {
          const { error: updErr } = await supabase
            .from("hr_leave_balances")
            .update({ used_days: balance.used_days + request.days_count })
            .eq("id", balance.id);
          if (updErr) throw updErr;
        }
      }

      // تسجيل الإجراء
      await supabase.from("hr_request_approvals").insert({
        request_id: request.id,
        approver_id: user?.id,
        action: status,
        comments: reason || null,
      });

      // إرسال إشعار لصاحب الطلب
      const notificationTitle = status === "approved" ? "تمت الموافقة على طلبك" : "تم رفض طلبك";

      const notificationMessage =
        status === "approved"
          ? `تمت الموافقة على طلب ${request.hr_request_types?.name_ar} رقم ${request.request_number}`
          : `تم رفض طلب ${request.hr_request_types?.name_ar} رقم ${request.request_number}$${reason ? `. السبب: ${reason}` : ""}`;

      await supabase.from("notifications").insert({
        user_id: request.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: status === "approved" ? "success" : "error",
      });
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "تم اعتماد الطلب" : "تم رفض الطلب");
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

  // حذف الطلب (فقط لصاحب الطلب)
  const deleteRequestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hr_requests").delete().eq("id", request.id);

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

  const handleDelete = () => {
    if (window.confirm("هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.")) {
      deleteRequestMutation.mutate();
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error("يرجى إدخال سبب الرفض");
      return;
    }

    if (isAdminView) {
      adminUpdateMutation.mutate({ status: "rejected", reason: rejectReason });
    } else {
      onReject?.(rejectReason);
    }

    setShowRejectForm(false);
    setRejectReason("");
  };

  const formatArabicDate = (dateStr: string | null) => {
    if (!dateStr) return "---";
    return format(new Date(dateStr), "d MMMM yyyy", { locale: ar });
  };

  const getRequestTypeText = () => {
    const typeName = request?.hr_request_types?.name_ar || "طلب";
    if (typeName.includes("إجازة")) {
      return `أتقدم لسعادتكم بطلب الحصول على ${typeName}`;
    } else if (typeName.includes("استئذان")) {
      return `أتقدم لسعادتكم بطلب ${typeName}`;
    }
    return `أتقدم لسعادتكم بطلب ${typeName}`;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const letterhead = new Image();
      letterhead.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        letterhead.onload = () => resolve();
        letterhead.onerror = () => reject(new Error("فشل تحميل القالب"));
        letterhead.src = "/letterhead-template.jpg";
      });

      pdf.addImage(letterhead, "JPEG", 0, 0, 210, 297);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.text(request.request_number, 65, 28, { align: "right" });
      pdf.text(format(new Date(request.created_at), "dd/MM/yyyy"), 65, 38, { align: "right" });

      pdf.save(`طلب-${request.request_number}.pdf`);
      toast.success("تم تصدير الطلب بنجاح");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("حدث خطأ أثناء إنشاء الملف");
    } finally {
      setGenerating(false);
    }
  };

  if (!request) return null;

  const statusInfo = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const canDelete = viewMode === "owner" && request.status === "pending";
  const showApprovalButtons = (viewMode === "approver" || viewMode === "admin") && request.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0 border-0 shadow-2xl rounded-2xl">
        <div className="flex flex-col h-full">
          {/* Header - تصميم أنيق ومُحكم */}
          <div className={`relative ${statusInfo.bgColor} px-5 py-3 border-b ${statusInfo.borderColor}`}>
            <div className="flex items-center justify-between gap-4">
              {/* زر الإغلاق منفصل على اليسار */}
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-lg bg-white/80 hover:bg-white border border-gray-200 flex items-center justify-center transition-colors shrink-0"
              >
                <XCircle className="w-4 h-4 text-gray-500" />
              </button>

              {/* العنوان والتفاصيل في المنتصف */}
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-xl ${statusInfo.iconBg} flex items-center justify-center shadow-lg`}>
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {request.hr_request_types?.name_ar || "طلب"}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground bg-white/60 px-2 py-0.5 rounded-full">
                      #{request.request_number}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(request.created_at), "d MMM yyyy", { locale: ar })}
                    </span>
                  </div>
                </div>
              </div>

              {/* حالة الطلب على اليمين */}
              <Badge className={`${statusInfo.bgColor} ${statusInfo.color} border ${statusInfo.borderColor} px-3 py-1 shrink-0`}>
                <StatusIcon className="w-3.5 h-3.5 ml-1" />
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          {/* Content - تخطيط ثنائي كبير وواضح */}
          <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-muted/10 to-background">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
              
              {/* الورق الرسمي - الجانب الأيسر */}
              <div className="order-2 lg:order-1">
                <div ref={previewRef}>
                  <LiveRequestPreview
                    employeeName={employeeData?.full_name || "---"}
                    jobRole={employeeData?.job_role || "---"}
                    signatureUrl={employeeData?.signature_url}
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
                    headerOffset={request.hr_request_types?.header_offset || 35}
                    letterheadUrl={request.hr_request_types?.letterhead_url || "/letterhead-template.jpg"}
                  />
                </div>

                {/* أزرار التصدير */}
                <div className="flex gap-3 mt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-10 rounded-xl border-2 hover:bg-primary/5"
                    onClick={() => window.print()}
                  >
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 h-10 rounded-xl border-2 hover:bg-primary/5"
                    onClick={generatePDF}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Download className="w-4 h-4 ml-2" />}
                    تصدير PDF
                  </Button>
                </div>
              </div>

              {/* تفاصيل الطلب - الجانب الأيمن */}
              <div className="order-1 lg:order-2 space-y-4">
                {/* معلومات مقدم الطلب */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white to-muted/30 rounded-2xl p-5 border border-gray-100 shadow-lg">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm text-foreground">مقدم الطلب</h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 ring-4 ring-white shadow-xl">
                        <AvatarImage src={employeeData?.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-xl font-bold">
                          {employeeData?.full_name?.charAt(0) || "؟"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-lg font-bold text-foreground">
                          {employeeData?.full_name || "---"}
                        </h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {employeeData?.job_role || "---"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* تفاصيل الطلب */}
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* التواريخ */}
                    {request.start_date && (
                      <div className="flex items-center gap-3 bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-3 border border-primary/10">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-medium text-muted-foreground">من تاريخ</div>
                          <div className="font-bold text-foreground">{formatArabicDate(request.start_date)}</div>
                        </div>
                      </div>
                    )}
                    
                    {request.end_date && (
                      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-xl p-3 border border-emerald-500/10">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                          <Calendar className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-medium text-muted-foreground">إلى تاريخ</div>
                          <div className="font-bold text-foreground">{formatArabicDate(request.end_date)}</div>
                        </div>
                      </div>
                    )}

                    {/* عدد الأيام */}
                    {request.days_count && (
                      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500/5 to-transparent rounded-xl p-3 border border-amber-500/10">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <CalendarDays className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-medium text-muted-foreground">المدة</div>
                          <div className="font-bold text-foreground">{request.days_count} يوم</div>
                        </div>
                      </div>
                    )}

                    {/* تاريخ التقديم */}
                    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-500/5 to-transparent rounded-xl p-3 border border-blue-500/10">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-medium text-muted-foreground">تاريخ التقديم</div>
                        <div className="font-bold text-foreground">
                          {format(new Date(request.created_at), "d MMM yyyy", { locale: ar })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* السبب */}
                  {request.reason && (
                    <div className="bg-gradient-to-r from-purple-500/5 to-transparent rounded-xl p-4 border border-purple-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center">
                          <MessageSquare className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">سبب الطلب</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{request.reason}</p>
                    </div>
                  )}

                  {/* ملاحظات */}
                  {request.notes && (
                    <div className="bg-gradient-to-r from-blue-500/5 to-transparent rounded-xl p-4 border border-blue-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-foreground">ملاحظات</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{request.notes}</p>
                    </div>
                  )}
                </div>

                {/* حالة الموافقات */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-lg relative">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <h3 className="font-semibold text-sm text-foreground">حالة الموافقات</h3>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg border-2"
                      onClick={() => setShowApprovalsDetails((v) => !v)}
                    >
                      {showApprovalsDetails ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                    </Button>
                  </div>

                  {/* عرض المسار بشكل مضغوط دائماً (يظهر جميع المراحل بشكل أيقونات) */}
                  <div className="bg-muted/20 rounded-xl p-3 border border-border/50" dir="rtl">
                    <WorkflowTimeline request={request} compact />
                  </div>

                  {/* تفاصيل الموافقات (قائمة منسدلة للأعلى) */}
                  {showApprovalsDetails && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl border-2 border-gray-200 shadow-xl p-3 space-y-2 max-h-80 overflow-y-auto z-50">
                      {request.substitute_employee_id && (
                        <div
                          className={`flex items-center justify-between p-3 rounded-xl border-2 ${
                            request.substitute_approved
                              ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                              : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                request.substitute_approved
                                  ? "bg-gradient-to-br from-emerald-400 to-green-500"
                                  : "bg-gradient-to-br from-amber-400 to-orange-500"
                              }`}
                            >
                              <UserCheck className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground">الموظف البديل</p>
                              <p className="text-xs text-muted-foreground">{substituteData?.full_name || "---"}</p>
                            </div>
                          </div>
                          <div
                            className={`px-3 py-1.5 rounded-lg font-semibold text-xs ${
                              request.substitute_approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {request.substitute_approved ? "✓ تمت الموافقة" : "⏳ في الانتظار"}
                          </div>
                        </div>
                      )}

                      {request.direct_manager_id && (
                        <div
                          className={`flex items-center justify-between p-3 rounded-xl border-2 ${
                            request.manager_approved
                              ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                              : "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                request.manager_approved
                                  ? "bg-gradient-to-br from-emerald-400 to-green-500"
                                  : "bg-gradient-to-br from-blue-400 to-cyan-500"
                              }`}
                            >
                              <Users className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground">المدير المباشر</p>
                              <p className="text-xs text-muted-foreground">{managerData?.full_name || "---"}</p>
                            </div>
                          </div>
                          <div
                            className={`px-3 py-1.5 rounded-lg font-semibold text-xs ${
                              request.manager_approved ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {request.manager_approved ? "✓ تمت الموافقة" : "⏳ في الانتظار"}
                          </div>
                        </div>
                      )}

                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border-2 ${
                          request.hr_manager_approved
                            ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                            : "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              request.hr_manager_approved
                                ? "bg-gradient-to-br from-emerald-400 to-green-500"
                                : "bg-gradient-to-br from-purple-400 to-violet-500"
                            }`}
                          >
                            <UserCheck className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">مدير الموارد البشرية</p>
                            <p className="text-xs text-muted-foreground">{hrManagerData?.full_name || "---"}</p>
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1.5 rounded-lg font-semibold text-xs ${
                            request.hr_manager_approved ? "bg-emerald-100 text-emerald-700" : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {request.hr_manager_approved ? "✓ تمت الموافقة" : "⏳ في الانتظار"}
                        </div>
                      </div>

                      <div
                        className={`flex items-center justify-between p-3 rounded-xl border-2 ${
                          request.executive_manager_approved
                            ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
                            : "bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              request.executive_manager_approved
                                ? "bg-gradient-to-br from-emerald-400 to-green-500"
                                : "bg-gradient-to-br from-slate-600 to-gray-700"
                            }`}
                          >
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">المدير التنفيذي</p>
                            <p className="text-xs text-muted-foreground">{executiveManagerData?.full_name || "---"}</p>
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1.5 rounded-lg font-semibold text-xs ${
                            request.executive_manager_approved ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {request.executive_manager_approved ? "✓ تمت الموافقة" : "⏳ في الانتظار"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* سبب الرفض */}
                {request.status === "rejected" && request.rejection_reason && (
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center">
                        <XCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="font-bold text-sm text-red-800">سبب الرفض</span>
                    </div>
                    <p className="text-sm text-red-700 leading-relaxed">{request.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions - تصميم أنيق */}
          <div className="border-t border-gray-100 p-6 bg-gradient-to-r from-muted/30 to-muted/10">
            {showRejectForm ? (
              <div className="space-y-4 animate-fade-in">
                <Textarea
                  placeholder="أدخل سبب الرفض..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[100px] rounded-xl border-2 focus:border-red-300 resize-none"
                />
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowRejectForm(false)} className="rounded-xl px-6">
                    إلغاء
                  </Button>
                  <Button variant="destructive" onClick={handleReject} className="rounded-xl px-6 shadow-lg shadow-red-500/20">
                    تأكيد الرفض
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {/* أزرار صاحب الطلب */}
                {canDelete && (
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={deleteRequestMutation.isPending}
                    className="border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl px-6"
                  >
                    {deleteRequestMutation.isPending ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 ml-2" />
                    )}
                    حذف الطلب
                  </Button>
                )}

                {/* أزرار المعتمد */}
                {showApprovalButtons && (
                  <div className="flex items-center gap-4 mr-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowRejectForm(true)}
                      className="border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl px-8 h-12"
                    >
                      <XCircle className="w-5 h-5 ml-2" />
                      رفض
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => {
                        if (isAdminView) {
                          adminUpdateMutation.mutate({ status: "approved" });
                        } else {
                          onApprove?.();
                        }
                      }}
                      disabled={isAdminView ? adminUpdateMutation.isPending : isApproving}
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-xl shadow-emerald-500/30 px-10 h-12 rounded-xl font-bold"
                    >
                      {(isAdminView ? adminUpdateMutation.isPending : isApproving) ? (
                        <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 ml-2" />
                      )}
                      {isAdminView
                        ? "اعتماد نهائي"
                        : approvalType === "substitute"
                          ? "موافقة كموظف بديل"
                          : approvalType === "manager"
                            ? "موافقة كمدير مباشر"
                            : "موافقة"}
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    </Button>
                  </div>
                )}

                {/* زر إغلاق */}
                {!showApprovalButtons && !canDelete && (
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="mr-auto rounded-xl px-8">
                    إغلاق
                  </Button>
                )}

                {(showApprovalButtons || canDelete) && (
                  <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
                    إغلاق
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
