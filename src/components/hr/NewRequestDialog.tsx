import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  Loader2,
  Upload,
  FileText,
  Heart,
  AlertTriangle,
  Clock,
  DollarSign,
  Award,
  User,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LiveRequestPreview } from "./LiveRequestPreview";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar: CalendarIcon,
  Heart,
  AlertTriangle,
  Clock,
  DollarSign,
  Award,
  FileText,
};

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  job_role: string;
  avatar_url: string | null;
}

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestTypes: any[];
  leaveBalances: any[];
  isAdmin?: boolean;
  employees?: Employee[];
}

export function NewRequestDialog({ 
  open, 
  onOpenChange, 
  requestTypes,
  leaveBalances,
  isAdmin = false,
  employees = []
}: NewRequestDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedType, setSelectedType] = useState<any>(null);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [substituteEmployee, setSubstituteEmployee] = useState("");
  const [directManager, setDirectManager] = useState("");

  // جلب بيانات الموظف الحالي
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !isAdmin && !!user?.id,
  });

  // جلب بيانات الموظف المختار (للمدير)
  const { data: selectedEmployeeData } = useQuery({
    queryKey: ["selected-employee-profile", selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("full_name, job_role, signature_url")
        .eq("user_id", selectedEmployee)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && !!selectedEmployee,
  });

  // جلب رصيد الموظف المختار (للمدير)
  const { data: employeeBalances = [] } = useQuery({
    queryKey: ["employee-leave-balances", selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const { data, error } = await supabase
        .from("hr_leave_balances")
        .select(`*, hr_request_types (*)`)
        .eq("user_id", selectedEmployee)
        .eq("year", new Date().getFullYear());
      if (error) throw error;
      return data;
    },
    enabled: isAdmin && !!selectedEmployee,
  });

  const currentBalances = isAdmin ? employeeBalances : leaveBalances;

  const daysCount = startDate && endDate 
    ? differenceInDays(endDate, startDate) + 1 
    : startDate ? 1 : 0;

  const generateRequestNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HR-${year}${month}-${random}`;
  };

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const targetUserId = isAdmin ? selectedEmployee : user?.id;
      if (!targetUserId || !selectedType) throw new Error("بيانات ناقصة");

      let attachmentUrl = null;
      let attachmentName = null;

      // رفع المرفق إن وجد
      if (attachment) {
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${targetUserId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(fileName, attachment);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(fileName);
        
        attachmentUrl = urlData.publicUrl;
        attachmentName = attachment.name;
      }

      const { data, error } = await supabase
        .from("hr_requests")
        .insert({
          user_id: targetUserId,
          request_type_id: selectedType.id,
          request_number: generateRequestNumber(),
          start_date: startDate?.toISOString().split('T')[0],
          end_date: endDate?.toISOString().split('T')[0] || startDate?.toISOString().split('T')[0],
          days_count: daysCount || null,
          reason,
          notes,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // إرسال إشعار للموظف إذا كان المدير هو من أنشأ الطلب
      if (isAdmin && selectedEmployee) {
        try {
          await supabase.from("notifications").insert({
            user_id: selectedEmployee,
            title: "طلب إجازة جديد",
            message: `تم إنشاء طلب ${selectedType?.name_ar || 'إجازة'} لك من قبل الإدارة. رقم الطلب: ${data.request_number}`,
            type: "hr_request",
          });
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
      
      toast.success(isAdmin ? "تم إنشاء الطلب للموظف بنجاح" : "تم تقديم الطلب بنجاح");
      queryClient.invalidateQueries({ queryKey: ["my-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-hr-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error creating request:", error);
      toast.error("حدث خطأ أثناء تقديم الطلب");
    },
  });

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedType(null);
    setStartDate(undefined);
    setEndDate(undefined);
    setReason("");
    setNotes("");
    setAttachment(null);
    setSubstituteEmployee("");
    setDirectManager("");
  };

  // إعادة تعيين النموذج عند الفتح
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAdmin && !selectedEmployee) {
      toast.error("يرجى اختيار الموظف");
      return;
    }

    if (!selectedType) {
      toast.error("يرجى اختيار نوع الطلب");
      return;
    }

    if (selectedType.deducts_from_balance && !startDate) {
      toast.error("يرجى تحديد تاريخ البداية");
      return;
    }

    if (selectedType.requires_attachment && !attachment) {
      toast.error("يرجى إرفاق المستند المطلوب");
      return;
    }

    // التحقق من الرصيد
    if (selectedType.deducts_from_balance) {
      const balance = currentBalances.find((b: any) => b.request_type_id === selectedType.id);
      const remaining = balance?.remaining_days ?? selectedType.max_days ?? 0;
      if (daysCount > remaining) {
        toast.error(`الرصيد المتبقي (${remaining} يوم) لا يكفي لهذا الطلب`);
        return;
      }
    }

    createRequestMutation.mutate();
  };

  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || FileText;
    return Icon;
  };

  // بيانات المعاينة
  const previewEmployeeData = isAdmin ? selectedEmployeeData : currentEmployee;
  const previewRequestNumber = `HR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-XXXX`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isAdmin ? "إنشاء طلب لموظف" : "طلب جديد"}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              {showPreview ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  إخفاء المعاينة
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  إظهار المعاينة
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className={cn("grid gap-6", showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {/* نموذج الإدخال */}
          <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
            
            {/* القسم الأول: بيانات مقدم الطلب */}
            <div className="bg-white rounded-xl p-5 border shadow-sm">
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2 border-b pb-3">
                <User className="w-5 h-5 text-primary" />
                بيانات مقدم الطلب
              </h3>
              
              <div className="space-y-4">
                {/* اختيار الموظف (للمدير فقط) */}
                {isAdmin ? (
                  <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                    <Label className="text-right font-semibold">الموظف <span className="text-destructive">*</span></Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee} dir="rtl">
                      <SelectTrigger className="bg-background text-right">
                        <SelectValue placeholder="اختر الموظف..." />
                      </SelectTrigger>
                      <SelectContent className="text-right" dir="rtl">
                        {employees.map((emp) => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                {emp.avatar_url ? (
                                  <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                              <span>{emp.full_name}</span>
                              <span className="text-xs text-muted-foreground">- {emp.job_role}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                      <Label className="text-right font-semibold">الاسم</Label>
                      <div className="bg-background border rounded-md px-3 py-2 text-sm">
                        {currentEmployee?.full_name || "---"}
                      </div>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                      <Label className="text-right font-semibold">المسمى الوظيفي</Label>
                      <div className="bg-background border rounded-md px-3 py-2 text-sm">
                        {currentEmployee?.job_role || "---"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* القسم الثاني: نوع الطلب */}
            <div className="bg-white rounded-xl p-5 border shadow-sm">
              <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2 border-b pb-3">
                <FileText className="w-5 h-5 text-primary" />
                نوع الطلب
              </h3>
              
              <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                <Label className="text-right font-semibold pt-2">اختر النوع <span className="text-destructive">*</span></Label>
                <Select 
                  value={selectedType?.id || ""} 
                  onValueChange={(val) => {
                    const type = requestTypes.find(t => t.id === val);
                    setSelectedType(type);
                  }}
                  dir="rtl"
                >
                  <SelectTrigger className="bg-background text-right">
                    <SelectValue placeholder="اختر نوع الطلب..." />
                  </SelectTrigger>
                  <SelectContent className="text-right" dir="rtl">
                    {requestTypes.map((type) => {
                      const Icon = getIcon(type.icon);
                      const balance = currentBalances.find((b: any) => b.request_type_id === type.id);
                      const remaining = balance?.remaining_days ?? type.max_days;
                      
                      return (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded ${type.color} flex items-center justify-center`}>
                              <Icon className="w-3 h-3 text-white" />
                            </div>
                            <span>{type.name_ar}</span>
                            {type.deducts_from_balance && remaining !== null && (
                              <span className="text-xs text-muted-foreground">(المتبقي: {remaining} يوم)</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedType && (
              <>
                {/* القسم الثالث: تفاصيل الطلب */}
                <div className="bg-white rounded-xl p-5 border shadow-sm">
                  <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2 border-b pb-3">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                    تفاصيل الطلب
                  </h3>
                  
                  <div className="space-y-4">
                    {/* التواريخ */}
                    {(selectedType.deducts_from_balance || selectedType.name === 'permission') && (
                      <>
                        <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                          <Label className="text-right font-semibold">تاريخ البداية <span className="text-destructive">*</span></Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-right font-normal bg-background",
                                  !startDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP", { locale: ar }) : "اختر التاريخ"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                              <Calendar
                                mode="single"
                                selected={startDate}
                                onSelect={setStartDate}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                          <Label className="text-right font-semibold">تاريخ النهاية</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-right font-normal bg-background",
                                  !endDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP", { locale: ar }) : "اختر التاريخ"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                              <Calendar
                                mode="single"
                                selected={endDate}
                                onSelect={setEndDate}
                                disabled={(date) => startDate ? date < startDate : false}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* عدد الأيام */}
                        {daysCount > 0 && (
                          <div className="grid grid-cols-[140px_1fr] gap-4 items-center">
                            <Label className="text-right font-semibold">مدة الإجازة</Label>
                            <div className="bg-accent/10 rounded-lg px-4 py-2 text-center inline-block">
                              <span className="font-bold text-accent">{daysCount} يوم</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* السبب */}
                    <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                      <Label className="text-right font-semibold pt-2">السبب</Label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="اكتب سبب الطلب..."
                        rows={3}
                        className="bg-background"
                      />
                    </div>

                    {/* ملاحظات */}
                    <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                      <Label className="text-right font-semibold pt-2">ملاحظات</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="أي ملاحظات إضافية..."
                        rows={2}
                        className="bg-background"
                      />
                    </div>

                    {/* الموظف البديل والمدير المباشر */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3">بيانات الموافقات</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-right font-semibold">الموظف البديل</Label>
                          <Select value={substituteEmployee} onValueChange={setSubstituteEmployee} dir="rtl">
                            <SelectTrigger className="bg-background text-right">
                              <SelectValue placeholder="اختر الموظف البديل..." />
                            </SelectTrigger>
                            <SelectContent className="text-right" dir="rtl">
                              {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.full_name}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden">
                                      {emp.avatar_url ? (
                                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="w-3 h-3 text-amber-600" />
                                      )}
                                    </div>
                                    <span>{emp.full_name}</span>
                                    <span className="text-xs text-muted-foreground">- {emp.job_role}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-right font-semibold">المدير المباشر</Label>
                          <Select value={directManager} onValueChange={setDirectManager} dir="rtl">
                            <SelectTrigger className="bg-background text-right">
                              <SelectValue placeholder="اختر المدير المباشر..." />
                            </SelectTrigger>
                            <SelectContent className="text-right" dir="rtl">
                              {employees.map((emp) => (
                                <SelectItem key={emp.id} value={emp.full_name}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
                                      {emp.avatar_url ? (
                                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="w-3 h-3 text-blue-600" />
                                      )}
                                    </div>
                                    <span>{emp.full_name}</span>
                                    <span className="text-xs text-muted-foreground">- {emp.job_role}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* القسم الرابع: المرفقات */}
                <div className="bg-white rounded-xl p-5 border shadow-sm">
                  <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2 border-b pb-3">
                    <Upload className="w-5 h-5 text-primary" />
                    المرفقات
                    {selectedType.requires_attachment && (
                      <span className="text-destructive text-sm">(مطلوب)</span>
                    )}
                  </h3>
                  
                  <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
                    <Label className="text-right font-semibold pt-2">رفع ملف</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center bg-background">
                      <input
                        type="file"
                        id="attachment"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                      />
                      <label 
                        htmlFor="attachment"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {attachment ? (
                          <>
                            <FileText className="w-8 h-8 text-accent" />
                            <span className="text-sm text-foreground">{attachment.name}</span>
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                setAttachment(null);
                              }}
                            >
                              إزالة
                            </Button>
                          </>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              اضغط لرفع ملف أو اسحبه هنا
                            </span>
                            <span className="text-xs text-muted-foreground">
                              PDF, DOC, JPG, PNG (حد أقصى 5MB)
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* أزرار الإجراءات */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={!selectedType || (isAdmin && !selectedEmployee) || createRequestMutation.isPending}
                className="bg-gradient-to-r from-accent to-teal-500 hover:from-accent/90 hover:to-teal-500/90"
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  isAdmin ? "إنشاء الطلب" : "تقديم الطلب"
                )}
              </Button>
            </div>
          </form>

          {/* معاينة النموذج الرسمي */}
          {showPreview && (
            <div className="hidden lg:block">
              <div className="sticky top-0">
                <Label className="mb-3 block text-center text-muted-foreground">
                  المعاينة الحية للنموذج الرسمي
                </Label>
                <LiveRequestPreview
                  employeeName={previewEmployeeData?.full_name || ""}
                  jobRole={previewEmployeeData?.job_role || ""}
                  signatureUrl={previewEmployeeData?.signature_url}
                  requestTypeName={selectedType?.name_ar || ""}
                  startDate={startDate}
                  endDate={endDate}
                  daysCount={daysCount}
                  reason={reason}
                  notes={notes}
                  requestNumber={previewRequestNumber}
                  substituteEmployee={substituteEmployee}
                  directManager={directManager}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
