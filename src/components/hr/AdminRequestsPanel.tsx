import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Search,
  Filter,
  User,
  Heart,
  AlertTriangle,
  DollarSign,
  Award,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { RequestDetailsDialog } from "./RequestDetailsDialog";
import { toast } from "sonner";

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

interface AdminRequestsPanelProps {
  requestTypes: any[];
}

export function AdminRequestsPanel({ requestTypes }: AdminRequestsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // جلب الموظفين
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("user_id, full_name, avatar_url, job_role");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // جلب جميع الطلبات
  const { data: requestsData = [], isLoading } = useQuery({
    queryKey: ["all-hr-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`*, hr_request_types (*)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // حذف الطلب
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("hr_requests")
        .delete()
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الطلب بنجاح");
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      setDeletingId(null);
    },
    onError: (error) => {
      console.error("Error deleting request:", error);
      toast.error("حدث خطأ أثناء حذف الطلب");
      setDeletingId(null);
    },
  });

  const handleDeleteRequest = (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation();
    if (window.confirm("هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.")) {
      setDeletingId(requestId);
      deleteRequestMutation.mutate(requestId);
    }
  };

  // دمج بيانات الموظفين مع الطلبات
  const allRequests = useMemo(() => {
    const employeeMap = new Map(employees.map((e: any) => [e.user_id, e]));
    return requestsData.map((r: any) => ({
      ...r,
      employees: employeeMap.get(r.user_id) || null,
    }));
  }, [requestsData, employees]);

  // تصفية الطلبات
  const filteredRequests = allRequests.filter((request: any) => {
    const matchesSearch = !searchQuery || 
      request.request_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.employees?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesType = typeFilter === "all" || request.request_type_id === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

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

  // إحصائيات سريعة
  const stats = {
    pending: allRequests.filter((r: any) => r.status === "pending").length,
    approved: allRequests.filter((r: any) => r.status === "approved").length,
    rejected: allRequests.filter((r: any) => r.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
            <div className="text-sm text-amber-600">قيد المراجعة</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
            <div className="text-sm text-green-600">موافق عليها</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
            <div className="text-sm text-red-600">مرفوضة</div>
          </CardContent>
        </Card>
      </div>

      {/* أدوات البحث والتصفية */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الطلب أو اسم الموظف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 ml-2" />
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending">قيد المراجعة</SelectItem>
            <SelectItem value="approved">موافق عليها</SelectItem>
            <SelectItem value="rejected">مرفوضة</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <FileText className="w-4 h-4 ml-2" />
            <SelectValue placeholder="نوع الطلب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأنواع</SelectItem>
            {requestTypes.map((type: any) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* قائمة الطلبات */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد طلبات</h3>
            <p className="text-muted-foreground">لا توجد طلبات تطابق معايير البحث</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request: any) => {
            const Icon = getRequestIcon(request.hr_request_types?.icon);
            return (
              <Card 
                key={request.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedRequest(request)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* أيقونة نوع الطلب */}
                    <div className={`w-12 h-12 rounded-xl ${request.hr_request_types?.color || 'bg-primary'} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    
                    {/* معلومات الموظف */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {request.employees?.avatar_url ? (
                          <img 
                            src={request.employees.avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {request.employees?.full_name || "موظف"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {request.employees?.job_role}
                        </div>
                      </div>
                    </div>

                    {/* تفاصيل الطلب */}
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
                            {format(new Date(request.start_date), "d MMM", { locale: ar })}
                            {request.end_date && request.end_date !== request.start_date && (
                              <> - {format(new Date(request.end_date), "d MMM", { locale: ar })}</>
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

                    {/* تاريخ التقديم وزر الحذف */}
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground text-left">
                        {format(new Date(request.created_at), "d MMM yyyy", { locale: ar })}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => handleDeleteRequest(e, request.id)}
                        disabled={deletingId === request.id}
                      >
                        {deletingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog تفاصيل الطلب */}
      <RequestDetailsDialog
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        isAdmin={true}
      />
    </div>
  );
}
