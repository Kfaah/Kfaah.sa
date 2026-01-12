import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  Printer
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import { OfficialRequestPDF } from "./OfficialRequestPDF";

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
        .select("full_name, job_role, signature_url")
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
        .select("full_name, job_role, signature_url")
        .eq("user_id", request.approved_by)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!request?.approved_by,
  });

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

      // إذا تمت الموافقة وكان الطلب يخصم من الرصيد
      if (status === "approved" && request.hr_request_types?.deducts_from_balance && request.days_count) {
        // تحديث رصيد الإجازات
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

      // تسجيل الإجراء
      await supabase
        .from("hr_request_approvals")
        .insert({
          request_id: request.id,
          approver_id: user?.id,
          action: status,
          comments: reason || null,
        });

      // إرسال إشعار للموظف
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

  if (!request) return null;

  const statusInfo = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            تفاصيل الطلب
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* رقم الطلب والحالة */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">رقم الطلب</span>
            <span className="font-mono font-semibold">{request.request_number}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">الحالة</span>
            <Badge variant="outline" className={`${statusInfo.color} gap-1`}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </Badge>
          </div>

          <Separator />

          {/* نوع الطلب */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">نوع الطلب</span>
            <span className="font-semibold">{request.hr_request_types?.name_ar}</span>
          </div>

          {/* التواريخ */}
          {request.start_date && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                التاريخ
              </span>
              <span>
                {format(new Date(request.start_date), "d MMM yyyy", { locale: ar })}
                {request.end_date && request.end_date !== request.start_date && (
                  <> - {format(new Date(request.end_date), "d MMM yyyy", { locale: ar })}</>
                )}
              </span>
            </div>
          )}

          {/* عدد الأيام */}
          {request.days_count && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-4 h-4" />
                المدة
              </span>
              <span>{request.days_count} يوم</span>
            </div>
          )}

          <Separator />

          {/* السبب */}
          {request.reason && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">السبب</span>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{request.reason}</p>
            </div>
          )}

          {/* ملاحظات */}
          {request.notes && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">ملاحظات</span>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{request.notes}</p>
            </div>
          )}

          {/* المرفق */}
          {request.attachment_url && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">المرفقات</span>
              <a 
                href={request.attachment_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <FileText className="w-5 h-5 text-accent" />
                <span className="flex-1 text-sm truncate">{request.attachment_name || "مرفق"}</span>
                <Download className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          )}

          {/* سبب الرفض */}
          {request.status === "rejected" && request.rejection_reason && (
            <div className="space-y-2">
              <span className="text-sm text-destructive">سبب الرفض</span>
              <p className="text-sm bg-destructive/10 text-destructive rounded-lg p-3">
                {request.rejection_reason}
              </p>
            </div>
          )}

          {/* تاريخ التقديم */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>تاريخ التقديم</span>
            <span>{format(new Date(request.created_at), "d MMM yyyy - HH:mm", { locale: ar })}</span>
          </div>

          {/* زر تصدير PDF - متاح دائماً */}
          {employeeData && (
            <>
              <Separator />
              <Button
                onClick={() => setShowPDFPreview(true)}
                variant={request.status === "approved" ? "default" : "outline"}
                className={request.status === "approved" 
                  ? "w-full bg-gradient-to-r from-accent to-teal-500" 
                  : "w-full"
                }
              >
                <Printer className="w-4 h-4 ml-2" />
                {request.status === "approved" ? "طباعة الطلب الرسمي" : "معاينة النموذج الرسمي"}
              </Button>
            </>
          )}

          {/* أزرار الإجراءات للمدير */}
          {isAdmin && request.status === "pending" && (
            <>
              <Separator />
              
              {showRejectionForm ? (
                <div className="space-y-3">
                  <Label>سبب الرفض</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="اكتب سبب رفض الطلب..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectionForm(false)}
                      className="flex-1"
                    >
                      إلغاء
                    </Button>
                    <Button
                      variant="destructive"
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
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectionForm(true)}
                    className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 ml-2" />
                    رفض
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={updateRequestMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {updateRequestMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 ml-2" />
                        موافقة
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>

      {/* نافذة معاينة PDF */}
      {employeeData && (
        <OfficialRequestPDF
          open={showPDFPreview}
          onOpenChange={setShowPDFPreview}
          request={request}
          employee={employeeData}
          approver={approverData}
        />
      )}
    </Dialog>
  );
}
