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
  User
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAdmin ? "إنشاء طلب لموظف" : "طلب جديد"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* اختيار الموظف (للمدير فقط) */}
          {isAdmin && (
            <div className="space-y-3">
              <Label>الموظف <span className="text-destructive">*</span></Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف..." />
                </SelectTrigger>
                <SelectContent>
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
          )}

          {/* اختيار نوع الطلب */}
          <div className="space-y-3">
            <Label>نوع الطلب <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {requestTypes.map((type) => {
                const Icon = getIcon(type.icon);
                const isSelected = selectedType?.id === type.id;
                const balance = currentBalances.find((b: any) => b.request_type_id === type.id);
                const remaining = balance?.remaining_days ?? type.max_days;
                
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-right",
                      isSelected 
                        ? "border-accent bg-accent/10" 
                        : "border-border hover:border-accent/50"
                    )}
                  >
                    <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center mb-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">{type.name_ar}</h4>
                    {type.deducts_from_balance && (isAdmin ? selectedEmployee : true) && remaining !== null && (
                      <p className="text-xs text-muted-foreground mt-1">
                        المتبقي: {remaining} يوم
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedType && (
            <>
              {/* التواريخ */}
              {(selectedType.deducts_from_balance || selectedType.name === 'permission') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>تاريخ البداية</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-right font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP", { locale: ar }) : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>تاريخ النهاية</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-right font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP", { locale: ar }) : "اختر التاريخ"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => startDate ? date < startDate : false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {/* عدد الأيام */}
              {daysCount > 0 && (
                <div className="bg-accent/10 rounded-lg p-3 text-center">
                  <span className="text-sm text-muted-foreground">مدة الإجازة: </span>
                  <span className="font-bold text-accent">{daysCount} يوم</span>
                </div>
              )}

              {/* السبب */}
              <div className="space-y-2">
                <Label>السبب</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="اكتب سبب الطلب..."
                  rows={3}
                />
              </div>

              {/* ملاحظات */}
              <div className="space-y-2">
                <Label>ملاحظات إضافية (اختياري)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                  rows={2}
                />
              </div>

              {/* المرفقات */}
              <div className="space-y-2">
                <Label>
                  المرفقات 
                  {selectedType.requires_attachment && (
                    <span className="text-destructive mr-1">*</span>
                  )}
                </Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
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
      </DialogContent>
    </Dialog>
  );
}
