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
  Eye,
  Sparkles,
  CalendarDays,
  Crown
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { RequestPreviewDialog } from "@/components/hr/RequestPreviewDialog";

type ApprovalType = "substitute" | "manager" | "executive";

export default function PendingApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [currentApprovalType, setCurrentApprovalType] = useState<ApprovalType>("substitute");

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

  // جلب الطلبات التي تحتاج موافقة كمدير تنفيذي
  const { data: executiveRequests, isLoading: loadingExecutive } = useQuery({
    queryKey: ["pending-executive-approvals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color)
        `)
        .eq("executive_manager_id", user?.id)
        .eq("executive_manager_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      
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
      setPreviewOpen(false);
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
      setPreviewOpen(false);
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

  // موافقة كمدير تنفيذي
  const executiveApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: employee } = await supabase
        .from("employees")
        .select("signature_url")
        .eq("user_id", user?.id)
        .single();

      if (!employee?.signature_url) {
        throw new Error("يجب إضافة توقيعك في الملف الشخصي أولاً");
      }

      // التحقق من موافقة مدير الموارد البشرية أولاً
      const { data: requestData } = await supabase
        .from("hr_requests")
        .select("hr_manager_approved")
        .eq("id", requestId)
        .single();

      if (!requestData?.hr_manager_approved) {
        throw new Error("لا يمكن الموافقة قبل موافقة مدير الموارد البشرية");
      }

      const { error } = await supabase
        .from("hr_requests")
        .update({
          executive_manager_approved: true,
          executive_manager_approved_at: new Date().toISOString(),
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-executive-approvals"] });
      setPreviewOpen(false);
      toast({
        title: "✅ تمت الموافقة النهائية",
        description: "تم اعتماد الطلب بنجاح",
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
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["pending-executive-approvals"] });
      setPreviewOpen(false);
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

  const handleViewRequest = (request: any, type: ApprovalType) => {
    setSelectedRequest(request);
    setCurrentApprovalType(type);
    setPreviewOpen(true);
  };

  const handleApprove = () => {
    if (!selectedRequest) return;
    if (currentApprovalType === "substitute") {
      substituteApproveMutation.mutate(selectedRequest.id);
    } else if (currentApprovalType === "manager") {
      managerApproveMutation.mutate(selectedRequest.id);
    } else {
      executiveApproveMutation.mutate(selectedRequest.id);
    }
  };

  const handleReject = (reason: string) => {
    if (!selectedRequest) return;
    rejectMutation.mutate({ requestId: selectedRequest.id, reason });
  };

  const allRequests = [
    ...(substituteRequests?.map(r => ({ ...r, approvalType: "substitute" as const })) || []),
    ...(managerRequests?.map(r => ({ ...r, approvalType: "manager" as const })) || []),
    ...(executiveRequests?.map(r => ({ ...r, approvalType: "executive" as const })) || [])
  ];

  const totalPending = allRequests.length;
  const isLoading = loadingSubstitute || loadingManager || loadingExecutive;

  const getApprovalStyle = (type: ApprovalType) => {
    switch (type) {
      case "substitute":
        return {
          gradient: "bg-gradient-to-b from-blue-500 to-cyan-500",
          badge: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0",
          icon: <UserCheck className="w-3 h-3 ml-1" />,
          label: "موافقتك كموظف بديل"
        };
      case "manager":
        return {
          gradient: "bg-gradient-to-b from-purple-500 to-pink-500",
          badge: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0",
          icon: <Users className="w-3 h-3 ml-1" />,
          label: "موافقتك كمدير"
        };
      case "executive":
        return {
          gradient: "bg-gradient-to-b from-green-600 to-emerald-600",
          badge: "bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0",
          icon: <Crown className="w-3 h-3 ml-1" />,
          label: "موافقتك كمدير تنفيذي"
        };
    }
  };

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
            <div className="grid grid-cols-4 gap-4 mt-6">
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
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{executiveRequests?.length || 0}</div>
                <div className="text-white/80 text-sm">كمدير تنفيذي</div>
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
          <div className="grid gap-4">
            {allRequests.map((request) => {
              const style = getApprovalStyle(request.approvalType);
              return (
                <Card 
                  key={`${request.id}-${request.approvalType}`} 
                  className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => handleViewRequest(request, request.approvalType)}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* شريط جانبي ملون */}
                      <div className={`w-2 ${style.gradient}`} />
                      
                      <div className="flex-1 p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="w-12 h-12 ring-2 ring-background shadow-md">
                              <AvatarImage src={request.requester?.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-white font-bold">
                                {request.requester?.full_name?.charAt(0) || "؟"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="font-bold text-foreground">
                                {request.requester?.full_name || "غير معروف"}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {request.requester?.job_role}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* نوع الموافقة */}
                            <Badge className={`px-3 py-1 text-xs font-medium ${style.badge}`}>
                              {style.icon}
                              {style.label}
                            </Badge>

                            <Button 
                              size="sm" 
                              className="bg-primary hover:bg-primary/90"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewRequest(request, request.approvalType);
                              }}
                            >
                              <Eye className="w-4 h-4 ml-2" />
                              استعراض
                            </Button>
                          </div>
                        </div>

                        {/* تفاصيل مختصرة */}
                        <div className="flex items-center gap-6 mt-4 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="w-4 h-4" />
                            <span className="font-medium">{request.hr_request_types?.name_ar}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Sparkles className="w-4 h-4" />
                            <span className="font-mono text-xs">{request.request_number}</span>
                          </div>
                          {request.days_count && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <CalendarDays className="w-4 h-4" />
                              <span>{request.days_count} يوم</span>
                            </div>
                          )}
                          {request.start_date && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>{format(new Date(request.start_date), "d MMM", { locale: ar })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

        {/* نافذة استعراض الطلب */}
        <RequestPreviewDialog
          request={selectedRequest}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          viewMode="approver"
          approvalType={currentApprovalType}
          onApprove={handleApprove}
          onReject={handleReject}
          isApproving={substituteApproveMutation.isPending || managerApproveMutation.isPending || executiveApproveMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
