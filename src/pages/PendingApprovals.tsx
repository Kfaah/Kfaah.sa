import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  CheckCircle, 
  Clock, 
  Calendar, 
  FileText, 
  UserCheck, 
  Users, 
  XCircle,
  Sparkles,
  ArrowLeft,
  CalendarDays,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function PendingApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string | null; type: "substitute" | "manager" }>({
    open: false,
    requestId: null,
    type: "substitute"
  });
  const [rejectReason, setRejectReason] = useState("");

  // جلب الطلبات التي تحتاج موافقة كموظف بديل
  const { data: substituteRequests, isLoading: loadingSubstitute } = useQuery({
    queryKey: ["pending-substitute-approvals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("substitute_employee_id", user?.id)
        .eq("substitute_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      
      // جلب بيانات الموظفين
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: employees } = await supabase
          .from("employees")
          .select("user_id, full_name, job_role, avatar_url")
          .in("user_id", userIds);
        
        return data.map(request => ({
          ...request,
          requester: employees?.find(e => e.user_id === request.user_id) || null
        }));
      }
      return data?.map(r => ({ ...r, requester: null })) || [];
    },
    enabled: !!user?.id,
  });

  // جلب الطلبات التي تحتاج موافقة كمدير مباشر
  const { data: managerRequests, isLoading: loadingManager } = useQuery({
    queryKey: ["pending-manager-approvals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("direct_manager_id", user?.id)
        .eq("manager_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      
      // جلب بيانات الموظفين
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: employees } = await supabase
          .from("employees")
          .select("user_id, full_name, job_role, avatar_url")
          .in("user_id", userIds);
        
        return data.map(request => ({
          ...request,
          requester: employees?.find(e => e.user_id === request.user_id) || null
        }));
      }
      return data?.map(r => ({ ...r, requester: null })) || [];
    },
    enabled: !!user?.id,
  });

  // موافقة كموظف بديل
  const substituteApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url")
        .eq("user_id", user?.id)
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
      toast({
        title: "✅ تمت الموافقة",
        description: "تم تسجيل موافقتك كموظف بديل بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // موافقة كمدير مباشر
  const managerApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url")
        .eq("user_id", user?.id)
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
      toast({
        title: "✅ تمت الموافقة",
        description: "تم تسجيل موافقتك كمدير مباشر بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // رفض الطلب
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, type, reason }: { requestId: string; type: "substitute" | "manager"; reason: string }) => {
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
      setRejectDialog({ open: false, requestId: null, type: "substitute" });
      setRejectReason("");
      toast({
        title: "تم الرفض",
        description: "تم رفض الطلب بنجاح",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const allRequests = [
    ...(substituteRequests?.map(r => ({ ...r, approvalType: "substitute" as const })) || []),
    ...(managerRequests?.map(r => ({ ...r, approvalType: "manager" as const })) || [])
  ];

  const totalPending = allRequests.length;
  const isLoading = loadingSubstitute || loadingManager;

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 mb-8">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">الموافقات المعلقة</h1>
                <p className="text-white/80 mt-1">
                  الطلبات التي تنتظر موافقتك
                </p>
              </div>
            </div>

            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{totalPending}</div>
                <div className="text-white/80 text-sm">إجمالي المعلقة</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{substituteRequests?.length || 0}</div>
                <div className="text-white/80 text-sm">كموظف بديل</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{managerRequests?.length || 0}</div>
                <div className="text-white/80 text-sm">كمدير مباشر</div>
              </div>
            </div>
          </div>
        </div>

        {/* قائمة الطلبات */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground">جارٍ تحميل الطلبات...</p>
          </div>
        ) : allRequests.length > 0 ? (
          <div className="grid gap-6">
            {allRequests.map((request, index) => (
              <Card 
                key={request.id} 
                className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-card/80"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* شريط جانبي ملون */}
                    <div className={`w-2 ${request.approvalType === "substitute" ? "bg-gradient-to-b from-blue-500 to-cyan-500" : "bg-gradient-to-b from-purple-500 to-pink-500"}`} />
                    
                    <div className="flex-1 p-6">
                      {/* رأس البطاقة */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-14 h-14 ring-4 ring-background shadow-lg">
                            <AvatarImage src={request.requester?.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white text-lg font-bold">
                              {request.requester?.full_name?.charAt(0) || "؟"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">
                              {request.requester?.full_name || "غير معروف"}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {request.requester?.job_role}
                            </p>
                          </div>
                        </div>

                        {/* نوع الموافقة */}
                        <Badge 
                          className={`px-4 py-2 text-sm font-medium ${
                            request.approvalType === "substitute" 
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0" 
                              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0"
                          }`}
                        >
                          {request.approvalType === "substitute" ? (
                            <>
                              <UserCheck className="w-4 h-4 ml-2" />
                              موظف بديل
                            </>
                          ) : (
                            <>
                              <Users className="w-4 h-4 ml-2" />
                              مدير مباشر
                            </>
                          )}
                        </Badge>
                      </div>

                      {/* تفاصيل الطلب */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* نوع الطلب */}
                        <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">نوع الطلب</div>
                            <div className="font-semibold text-foreground">
                              {request.hr_request_types?.name_ar}
                            </div>
                          </div>
                        </div>

                        {/* رقم الطلب */}
                        <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">رقم الطلب</div>
                            <div className="font-semibold text-foreground font-mono">
                              {request.request_number}
                            </div>
                          </div>
                        </div>

                        {/* عدد الأيام */}
                        {request.days_count && (
                          <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <CalendarDays className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">المدة</div>
                              <div className="font-semibold text-foreground">
                                {request.days_count} يوم
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* التواريخ */}
                      {request.start_date && (
                        <div className="flex items-center gap-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 mb-6">
                          <Calendar className="w-5 h-5 text-primary" />
                          <span className="text-foreground">
                            من <span className="font-semibold">{format(new Date(request.start_date), "d MMMM yyyy", { locale: ar })}</span>
                            {request.end_date && (
                              <> إلى <span className="font-semibold">{format(new Date(request.end_date), "d MMMM yyyy", { locale: ar })}</span></>
                            )}
                          </span>
                        </div>
                      )}

                      {/* السبب */}
                      {request.reason && (
                        <div className="flex items-start gap-3 bg-muted/30 rounded-xl p-4 mb-6">
                          <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">سبب الطلب</div>
                            <p className="text-foreground">{request.reason}</p>
                          </div>
                        </div>
                      )}

                      {/* تاريخ التقديم + الأزرار */}
                      <div className="flex items-center justify-between pt-4 border-t border-border/50">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>
                            تم التقديم {format(new Date(request.created_at), "d MMMM yyyy - HH:mm", { locale: ar })}
                          </span>
                        </div>

                        {/* أزرار الإجراءات */}
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setRejectDialog({ 
                              open: true, 
                              requestId: request.id, 
                              type: request.approvalType 
                            })}
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                          >
                            <XCircle className="w-5 h-5 ml-2" />
                            رفض
                          </Button>
                          <Button
                            size="lg"
                            onClick={() => {
                              if (request.approvalType === "substitute") {
                                substituteApproveMutation.mutate(request.id);
                              } else {
                                managerApproveMutation.mutate(request.id);
                              }
                            }}
                            disabled={substituteApproveMutation.isPending || managerApproveMutation.isPending}
                            className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg shadow-emerald-500/25"
                          >
                            <CheckCircle className="w-5 h-5 ml-2" />
                            {(substituteApproveMutation.isPending || managerApproveMutation.isPending) 
                              ? "جارٍ الموافقة..." 
                              : "موافقة"}
                            <ArrowLeft className="w-4 h-4 mr-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">لا توجد طلبات معلقة</h3>
              <p className="text-muted-foreground text-center max-w-md">
                جميع الطلبات تمت مراجعتها. ستظهر هنا أي طلبات جديدة تحتاج موافقتك.
              </p>
            </CardContent>
          </Card>
        )}

        {/* نافذة الرفض */}
        <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                رفض الطلب
              </DialogTitle>
              <DialogDescription>
                يرجى إدخال سبب الرفض لإعلام مقدم الطلب
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="أدخل سبب الرفض..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[120px]"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialog({ open: false, requestId: null, type: "substitute" });
                  setRejectReason("");
                }}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectDialog.requestId && rejectReason.trim()) {
                    rejectMutation.mutate({
                      requestId: rejectDialog.requestId,
                      type: rejectDialog.type,
                      reason: rejectReason
                    });
                  }
                }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? "جارٍ الرفض..." : "تأكيد الرفض"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
