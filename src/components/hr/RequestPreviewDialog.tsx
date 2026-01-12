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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  UserCheck,
  Users,
  Trash2,
  Sparkles,
  CalendarDays,
  MessageSquare,
  Printer,
  ArrowLeft,
  Building2,
  Hash,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  approvalType?: "substitute" | "manager" | "admin";
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
  const [activeTab, setActiveTab] = useState<"official" | "details">("official");
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
        .single();
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
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.direct_manager_id && open,
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
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0 border-0 shadow-2xl">
        <div className="flex flex-col h-full max-h-[95vh]">
          {/* Header - تصميم أنيق مع تدرج فاخر */}
          <div className={`relative ${statusInfo.bgColor} p-8 border-b ${statusInfo.borderColor} overflow-hidden`}>
            {/* خلفية زخرفية */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
            </div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl ${statusInfo.iconBg} flex items-center justify-center shadow-xl shadow-black/10`}>
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    {request.hr_request_types?.name_ar || "طلب"}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full">
                      <Hash className="w-3.5 h-3.5" />
                      {request.request_number}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-white/60 backdrop-blur-sm px-3 py-1 rounded-full">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(request.created_at), "d MMMM yyyy", { locale: ar })}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`flex items-center gap-2 ${statusInfo.bgColor} ${statusInfo.color} px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg border ${statusInfo.borderColor} backdrop-blur-sm`}>
                <StatusIcon className="w-5 h-5" />
                {statusInfo.label}
              </div>
            </div>
          </div>

          {/* Content with Tabs */}
          <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-muted/20 to-background">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* الورق الرسمي - الجانب الأيسر */}
              <div className="order-2 lg:order-1">
                <div className="sticky top-0">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">معاينة النموذج الرسمي</h3>
                  </div>
                  <div 
                    ref={previewRef}
                    className="relative bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100 ring-1 ring-gray-100"
                    style={{ aspectRatio: "210/297" }}
                  >
                    <img
                      src="/letterhead-template.jpg"
                      alt="قالب الخطاب"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    <div className="absolute inset-0 flex flex-col p-4" dir="rtl">
                      {/* رقم وتاريخ الطلب */}
                      <div className="absolute top-[8%] right-[22%] text-[8px] space-y-1">
                        <p className="font-semibold">{request.request_number}</p>
                        <p>{format(new Date(request.created_at), "dd/MM/yyyy")}</p>
                      </div>

                      {/* محتوى الطلب */}
                      <div className="mt-[25%] mx-auto w-[85%] space-y-2 text-[9px] leading-relaxed text-right">
                        <h2 className="text-[11px] font-bold text-center mb-3">
                          طلب {request.hr_request_types?.name_ar || "إجازة"}
                        </h2>

                        <p className="font-semibold text-[8px]">صاحب السعادة المدير العام    حفظه الله</p>
                        <p className="text-[8px]">السلام عليكم ورحمة الله وبركاته، وبعد:</p>
                        
                        <div className="mt-2 space-y-0.5 text-[8px]">
                          <p><span className="font-semibold">أنا الموقع أدناه:</span> {employeeData?.full_name || "---"}</p>
                          <p><span className="font-semibold">المسمى الوظيفي:</span> {employeeData?.job_role || "---"}</p>
                        </div>

                        <p className="mt-2 text-[8px]">{getRequestTypeText()}</p>

                        <div className="space-y-0.5 text-[8px]">
                          {request.start_date && (
                            <p><span className="font-semibold">من تاريخ:</span> {format(new Date(request.start_date), "dd/MM/yyyy")}</p>
                          )}
                          {request.end_date && request.end_date !== request.start_date && (
                            <p><span className="font-semibold">إلى تاريخ:</span> {format(new Date(request.end_date), "dd/MM/yyyy")}</p>
                          )}
                          {request.days_count && (
                            <p><span className="font-semibold">عدد الأيام:</span> ({request.days_count}) يوم</p>
                          )}
                        </div>

                        {request.reason && (
                          <p className="mt-1 text-[8px]"><span className="font-semibold">السبب:</span> {request.reason}</p>
                        )}

                        <p className="mt-2 text-[7px]">آمل من سعادتكم التكرم بالموافقة على طلبي.</p>
                        <p className="text-[7px]">وتقبلوا فائق الاحترام والتقدير،،،</p>

                        {/* التوقيعات */}
                        <div className="grid grid-cols-4 gap-1 mt-4 pt-2 border-t border-gray-200">
                          {/* مقدم الطلب */}
                          <div className="text-center">
                            <p className="font-semibold text-[6px] text-gray-600">مقدم الطلب</p>
                            <p className="text-[6px] truncate">{employeeData?.full_name || "---"}</p>
                            {employeeData?.signature_url && (
                              <img src={employeeData.signature_url} alt="توقيع" className="h-5 mx-auto mt-0.5 object-contain" />
                            )}
                          </div>

                          {/* الموظف البديل */}
                          <div className="text-center">
                            <p className="font-semibold text-[6px] text-amber-600">الموظف البديل</p>
                            {substituteData ? (
                              <>
                                <p className="text-[6px] truncate">{substituteData.full_name}</p>
                                {request.substitute_approved && substituteData.signature_url ? (
                                  <img src={substituteData.signature_url} alt="توقيع" className="h-5 mx-auto mt-0.5 object-contain" />
                                ) : (
                                  <p className="text-[5px] text-amber-500 mt-1">في الانتظار</p>
                                )}
                              </>
                            ) : (
                              <p className="text-[5px] text-gray-400 mt-1">---</p>
                            )}
                          </div>

                          {/* المدير المباشر */}
                          <div className="text-center">
                            <p className="font-semibold text-[6px] text-blue-600">المدير المباشر</p>
                            {managerData ? (
                              <>
                                <p className="text-[6px] truncate">{managerData.full_name}</p>
                                {request.manager_approved && managerData.signature_url ? (
                                  <img src={managerData.signature_url} alt="توقيع" className="h-5 mx-auto mt-0.5 object-contain" />
                                ) : (
                                  <p className="text-[5px] text-blue-500 mt-1">في الانتظار</p>
                                )}
                              </>
                            ) : (
                              <p className="text-[5px] text-gray-400 mt-1">---</p>
                            )}
                          </div>

                          {/* اعتماد الإدارة */}
                          <div className="text-center">
                            <p className="font-semibold text-[6px] text-emerald-600">اعتماد الإدارة</p>
                            {request.status === "approved" && approverData ? (
                              <>
                                <p className="text-[6px] truncate">{approverData.full_name}</p>
                                {approverData.signature_url && (
                                  <img src={approverData.signature_url} alt="توقيع" className="h-5 mx-auto mt-0.5 object-contain" />
                                )}
                              </>
                            ) : (
                              <p className="text-[5px] text-gray-400 mt-1">في الانتظار</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* أزرار التصدير */}
                  <div className="flex gap-3 mt-5">
                    <Button 
                      variant="outline" 
                      className="flex-1 h-11 rounded-xl border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
                      onClick={() => window.print()}
                    >
                      <Printer className="w-4 h-4 ml-2" />
                      طباعة
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 h-11 rounded-xl border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
                      onClick={generatePDF}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 ml-2" />
                      )}
                      تصدير PDF
                    </Button>
                  </div>
                </div>
              </div>

              {/* تفاصيل الطلب - الجانب الأيمن */}
              <div className="order-1 lg:order-2 space-y-6">
                {/* معلومات مقدم الطلب */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white to-muted/30 rounded-2xl p-6 border border-gray-100 shadow-lg">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">مقدم الطلب</h3>
                    </div>
                    <div className="flex items-center gap-5">
                      <Avatar className="w-18 h-18 ring-4 ring-white shadow-xl">
                        <AvatarImage src={employeeData?.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-2xl font-bold">
                          {employeeData?.full_name?.charAt(0) || "؟"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-xl font-bold text-foreground">
                          {employeeData?.full_name || "---"}
                        </h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <Building2 className="w-4 h-4" />
                          {employeeData?.job_role || "---"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* تفاصيل الطلب */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-foreground">تفاصيل الطلب</h3>
                  </div>

                  <div className="grid gap-4">
                    {/* التواريخ */}
                    {request.start_date && (
                      <div className="flex items-center gap-4 bg-gradient-to-r from-primary/5 to-transparent rounded-xl p-4 border border-primary/10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                          <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">الفترة</div>
                          <div className="font-bold text-foreground text-lg">
                            {formatArabicDate(request.start_date)}
                            {request.end_date && request.end_date !== request.start_date && (
                              <span className="text-muted-foreground font-normal"> إلى {formatArabicDate(request.end_date)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* عدد الأيام */}
                    {request.days_count && (
                      <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-xl p-4 border border-emerald-500/10">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                          <CalendarDays className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">المدة</div>
                          <div className="font-bold text-foreground text-lg">{request.days_count} يوم</div>
                        </div>
                      </div>
                    )}

                    {/* تاريخ التقديم */}
                    <div className="flex items-center gap-4 bg-gradient-to-r from-amber-500/5 to-transparent rounded-xl p-4 border border-amber-500/10">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">تاريخ التقديم</div>
                        <div className="font-bold text-foreground text-lg">
                          {format(new Date(request.created_at), "d MMMM yyyy - HH:mm", { locale: ar })}
                        </div>
                      </div>
                    </div>

                    {/* السبب */}
                    {request.reason && (
                      <div className="bg-gradient-to-r from-purple-500/5 to-transparent rounded-xl p-5 border border-purple-500/10">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-violet-500 flex items-center justify-center">
                            <MessageSquare className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">سبب الطلب</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{request.reason}</p>
                      </div>
                    )}

                    {/* ملاحظات */}
                    {request.notes && (
                      <div className="bg-gradient-to-r from-blue-500/5 to-transparent rounded-xl p-5 border border-blue-500/10">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">ملاحظات</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{request.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* حالة الموافقات */}
                {(substituteData || managerData) && (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-semibold text-foreground">حالة الموافقات</h3>
                    </div>

                    <div className="space-y-3">
                      {/* الموظف البديل */}
                      {substituteData && (
                        <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          request.substitute_approved 
                            ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200" 
                            : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                        }`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                              request.substitute_approved 
                                ? "bg-gradient-to-br from-emerald-400 to-green-500" 
                                : "bg-gradient-to-br from-amber-400 to-orange-500"
                            }`}>
                              <UserCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">الموظف البديل</p>
                              <p className="text-sm text-muted-foreground">{substituteData.full_name}</p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                            request.substitute_approved 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {request.substitute_approved ? "✓ تمت الموافقة" : "⏳ في الانتظار"}
                          </div>
                        </div>
                      )}

                      {/* المدير المباشر */}
                      {managerData && (
                        <div className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          request.manager_approved 
                            ? "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200" 
                            : "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200"
                        }`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                              request.manager_approved 
                                ? "bg-gradient-to-br from-emerald-400 to-green-500" 
                                : "bg-gradient-to-br from-blue-400 to-cyan-500"
                            }`}>
                              <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">المدير المباشر</p>
                              <p className="text-sm text-muted-foreground">{managerData.full_name}</p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                            request.manager_approved 
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {request.manager_approved ? "✓ تمت الموافقة" : "⏳ في الانتظار"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* سبب الرفض */}
                {request.status === "rejected" && request.rejection_reason && (
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-md">
                        <XCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-bold text-red-800">سبب الرفض</span>
                    </div>
                    <p className="text-red-700 leading-relaxed">{request.rejection_reason}</p>
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
                      <ArrowLeft className="w-4 h-4 mr-2" />
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
