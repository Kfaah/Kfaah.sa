import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CheckCircle, Clock, User, Calendar, FileText, UserCheck, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PendingApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // جلب الطلبات التي تحتاج موافقة كموظف بديل
  const { data: substituteRequests, isLoading: loadingSubstitute } = useQuery({
    queryKey: ["pending-substitute-approvals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (name, name_ar, icon, color),
          requester:employees!hr_requests_user_id_fkey (full_name, job_role, avatar_url)
        `)
        .eq("substitute_employee_id", user?.id)
        .eq("substitute_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      return data;
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
          hr_request_types (name, name_ar, icon, color),
          requester:employees!hr_requests_user_id_fkey (full_name, job_role, avatar_url)
        `)
        .eq("direct_manager_id", user?.id)
        .eq("manager_approved", false)
        .neq("status", "rejected");
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // موافقة كموظف بديل
  const substituteApproveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // جلب توقيع الموظف الحالي
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
        title: "تمت الموافقة",
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
      // جلب توقيع الموظف الحالي
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
        title: "تمت الموافقة",
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

  const RequestCard = ({ 
    request, 
    approvalType, 
    onApprove, 
    isApproving 
  }: { 
    request: any; 
    approvalType: "substitute" | "manager";
    onApprove: () => void;
    isApproving: boolean;
  }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* صورة مقدم الطلب */}
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 flex-shrink-0">
            {request.requester?.avatar_url ? (
              <img 
                src={request.requester.avatar_url} 
                alt={request.requester?.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold">
                {request.requester?.full_name?.charAt(0) || "؟"}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            {/* معلومات الطلب */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">
                  {request.requester?.full_name || "غير معروف"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {request.requester?.job_role}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {request.request_number}
              </Badge>
            </div>

            {/* نوع الطلب */}
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {request.hr_request_types?.name_ar}
              </span>
            </div>

            {/* التواريخ */}
            {request.start_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  من {format(new Date(request.start_date), "d MMMM yyyy", { locale: ar })}
                  {request.end_date && (
                    <> إلى {format(new Date(request.end_date), "d MMMM yyyy", { locale: ar })}</>
                  )}
                </span>
                {request.days_count && (
                  <Badge variant="secondary" className="mr-2">
                    {request.days_count} يوم
                  </Badge>
                )}
              </div>
            )}

            {/* السبب */}
            {request.reason && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-2">
                {request.reason}
              </p>
            )}

            {/* تاريخ التقديم */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>
                تم التقديم في {format(new Date(request.created_at), "d MMMM yyyy - HH:mm", { locale: ar })}
              </span>
            </div>

            {/* نوع الموافقة المطلوبة */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Badge 
                variant="outline" 
                className={approvalType === "substitute" 
                  ? "bg-blue-50 text-blue-700 border-blue-200" 
                  : "bg-purple-50 text-purple-700 border-purple-200"
                }
              >
                {approvalType === "substitute" ? (
                  <>
                    <UserCheck className="w-3 h-3 ml-1" />
                    موافقتك كموظف بديل
                  </>
                ) : (
                  <>
                    <Users className="w-3 h-3 ml-1" />
                    موافقتك كمدير مباشر
                  </>
                )}
              </Badge>

              <Button
                size="sm"
                onClick={onApprove}
                disabled={isApproving}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 ml-1" />
                {isApproving ? "جارٍ الموافقة..." : "موافقة"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const totalPending = (substituteRequests?.length || 0) + (managerRequests?.length || 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">الموافقات المعلقة</h1>
            <p className="text-muted-foreground">
              الطلبات التي تحتاج موافقتك كموظف بديل أو مدير مباشر
            </p>
          </div>
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {totalPending} طلب معلق
            </Badge>
          )}
        </div>

        <Tabs defaultValue="substitute" dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="substitute" className="gap-2">
              <UserCheck className="w-4 h-4" />
              كموظف بديل
              {substituteRequests && substituteRequests.length > 0 && (
                <Badge variant="secondary" className="mr-1">
                  {substituteRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="manager" className="gap-2">
              <Users className="w-4 h-4" />
              كمدير مباشر
              {managerRequests && managerRequests.length > 0 && (
                <Badge variant="secondary" className="mr-1">
                  {managerRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="substitute" className="mt-4">
            {loadingSubstitute ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : substituteRequests && substituteRequests.length > 0 ? (
              <div className="grid gap-4">
                {substituteRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    approvalType="substitute"
                    onApprove={() => substituteApproveMutation.mutate(request.id)}
                    isApproving={substituteApproveMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <UserCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-lg">
                    لا توجد طلبات تحتاج موافقتك كموظف بديل
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="manager" className="mt-4">
            {loadingManager ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : managerRequests && managerRequests.length > 0 ? (
              <div className="grid gap-4">
                {managerRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    approvalType="manager"
                    onApprove={() => managerApproveMutation.mutate(request.id)}
                    isApproving={managerApproveMutation.isPending}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground text-lg">
                    لا توجد طلبات تحتاج موافقتك كمدير مباشر
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
