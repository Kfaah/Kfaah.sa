import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Settings,
  Image,
  Type,
  List,
  Workflow,
  Save,
  Trash2,
  Edit,
  Eye,
  Upload,
  GripVertical,
  Calendar,
  FileUp,
  AlignLeft,
  ToggleLeft,
  Hash,
  Sparkles,
  Loader2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { TemplatePreview } from "@/components/hr/TemplatePreview";
import { LetterheadAdjuster } from "@/components/hr/LetterheadAdjuster";

interface CustomField {
  id: string;
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "select" | "file" | "number" | "checkbox";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface WorkflowStage {
  id: string;
  order: number;
  name: string;
  approverRole: "admin" | "moderator" | "specific_user";
  approverUserId?: string;
  isRequired: boolean;
  canReject: boolean;
}

interface RequestType {
  id: string;
  name: string;
  name_ar: string;
  icon: string;
  color: string;
  description: string | null;
  requires_attachment: boolean;
  deducts_from_balance: boolean;
  max_days: number | null;
  is_active: boolean;
  letterhead_url: string | null;
  header_text: string | null;
  greeting_text: string | null;
  body_template: string | null;
  closing_text: string | null;
  custom_fields: CustomField[];
  workflow_stages: WorkflowStage[];
  show_dates: boolean;
  show_reason: boolean;
  show_notes: boolean;
  header_offset: number | null;
}

const fieldTypeIcons: Record<string, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  textarea: <AlignLeft className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  select: <List className="w-4 h-4" />,
  file: <FileUp className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  checkbox: <ToggleLeft className="w-4 h-4" />,
};

const fieldTypeLabels: Record<string, string> = {
  text: "نص قصير",
  textarea: "نص طويل",
  date: "تاريخ",
  select: "قائمة اختيار",
  file: "ملف مرفق",
  number: "رقم",
  checkbox: "خيار (نعم/لا)",
};

export default function HRTemplates() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [aiInstruction, setAiInstruction] = useState("");
  const [isApplyingAI, setIsApplyingAI] = useState(false);
  
  // Form state
  const [editData, setEditData] = useState<Partial<RequestType>>({});
  const [newField, setNewField] = useState<Partial<CustomField>>({
    type: "text",
    required: false,
  });
  const [newStage, setNewStage] = useState<Partial<WorkflowStage>>({
    approverRole: "admin",
    isRequired: true,
    canReject: true,
  });

  // Apply AI instructions to template
  const handleApplyAIInstruction = async () => {
    if (!aiInstruction.trim()) {
      toast.error("يرجى إدخال التعليمات");
      return;
    }
    
    setIsApplyingAI(true);
    try {
      const response = await supabase.functions.invoke("apply-template-instructions", {
        body: {
          instruction: aiInstruction,
          currentTemplate: editData,
        },
      });

      if (response.error) throw response.error;
      
      const updatedTemplate = response.data;
      setEditData(prev => ({
        ...prev,
        ...updatedTemplate,
      }));
      
      toast.success("تم تطبيق التعليمات بنجاح");
      setAiInstruction("");
    } catch (error) {
      console.error("Error applying AI instruction:", error);
      toast.error("حدث خطأ أثناء تطبيق التعليمات");
    } finally {
      setIsApplyingAI(false);
    }
  };

  const { data: requestTypes = [], isLoading } = useQuery({
    queryKey: ["hr-request-types-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_request_types")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data.map((type: any) => ({
        ...type,
        custom_fields: type.custom_fields || [],
        workflow_stages: type.workflow_stages || [],
      })) as RequestType[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-workflow"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("user_id, full_name, job_role")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async (data: Partial<RequestType> & { id: string }) => {
      const { data: updated, error } = await supabase
        .from("hr_request_types")
        .update({
          name: data.name,
          name_ar: data.name_ar,
          description: data.description,
          icon: data.icon,
          color: data.color,
          requires_attachment: data.requires_attachment,
          deducts_from_balance: data.deducts_from_balance,
          max_days: data.max_days,
          is_active: data.is_active,
          letterhead_url: data.letterhead_url,
          header_text: data.header_text,
          greeting_text: data.greeting_text,
          body_template: data.body_template,
          closing_text: data.closing_text,
          custom_fields: data.custom_fields as any,
          workflow_stages: data.workflow_stages as any,
          show_dates: data.show_dates,
          show_reason: data.show_reason,
          show_notes: data.show_notes,
          header_offset: data.header_offset,
        })
        .eq("id", data.id)
        .select("*")
        .single();

      if (error) throw error;

      return {
        ...(updated as any),
        custom_fields: (updated as any).custom_fields || [],
        workflow_stages: (updated as any).workflow_stages || [],
      } as RequestType;
    },
    onSuccess: (savedData) => {
      toast.success("تم حفظ التعديلات بنجاح");

      // تحديث الكاش مباشرة لضمان أن اختيار النوع/المعاينة يقرأ أحدث نسخة
      queryClient.setQueryData(["hr-request-types-full"], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((t: any) => (t.id === savedData.id ? savedData : t));
      });
      queryClient.setQueryData(["hr-request-types"], (prev: any) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((t: any) => (t.id === savedData.id ? savedData : t));
      });

      // وتحديث حالة الصفحة الحالية
      setSelectedType(savedData);
      setEditData(savedData);
    },
    onError: (error) => {
      console.error("Error updating type:", error);
      toast.error("حدث خطأ أثناء الحفظ");
    },
  });

  const handleSelectType = (type: RequestType) => {
    setSelectedType(type);
    setEditData({ ...type });
    setIsEditing(true);
  };

  const handleUploadLetterhead = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `letterhead-${selectedType?.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("hr-templates")
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from("hr-templates")
        .getPublicUrl(fileName);
      
      setEditData(prev => ({ ...prev, letterhead_url: urlData.publicUrl }));
      toast.success("تم رفع صورة الخلفية");
    } catch (error) {
      console.error("Error uploading letterhead:", error);
      toast.error("حدث خطأ أثناء رفع الصورة");
    }
  };

  const handleAddField = () => {
    if (!newField.name || !newField.label) {
      toast.error("يرجى إدخال اسم ومسمى الحقل");
      return;
    }

    const field: CustomField = {
      id: crypto.randomUUID(),
      name: newField.name!,
      label: newField.label!,
      type: newField.type as CustomField["type"],
      required: newField.required || false,
      options: newField.options,
      placeholder: newField.placeholder,
    };

    setEditData(prev => ({
      ...prev,
      custom_fields: [...(prev.custom_fields || []), field],
    }));

    setNewField({ type: "text", required: false });
    toast.success("تم إضافة الحقل");
  };

  const handleRemoveField = (fieldId: string) => {
    setEditData(prev => ({
      ...prev,
      custom_fields: (prev.custom_fields || []).filter(f => f.id !== fieldId),
    }));
  };

  const handleAddStage = () => {
    if (!newStage.name) {
      toast.error("يرجى إدخال اسم المرحلة");
      return;
    }

    const stage: WorkflowStage = {
      id: crypto.randomUUID(),
      order: (editData.workflow_stages?.length || 0) + 1,
      name: newStage.name!,
      approverRole: newStage.approverRole as WorkflowStage["approverRole"],
      approverUserId: newStage.approverUserId,
      isRequired: newStage.isRequired ?? true,
      canReject: newStage.canReject ?? true,
    };

    setEditData(prev => ({
      ...prev,
      workflow_stages: [...(prev.workflow_stages || []), stage],
    }));

    setNewStage({ approverRole: "admin", isRequired: true, canReject: true });
    toast.success("تم إضافة المرحلة");
  };

  const handleRemoveStage = (stageId: string) => {
    setEditData(prev => ({
      ...prev,
      workflow_stages: (prev.workflow_stages || [])
        .filter(s => s.id !== stageId)
        .map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  const handleSave = () => {
    if (!selectedType) return;
    updateTypeMutation.mutate({
      id: selectedType.id,
      ...editData,
    });
  };

  // حذف القالب
  const deleteTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("hr_request_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف النموذج بنجاح");
      queryClient.invalidateQueries({ queryKey: ["hr-request-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["hr-request-types"] });
      setIsEditing(false);
      setSelectedType(null);
    },
    onError: (error: any) => {
      console.error("Error deleting type:", error);
      if (error?.message?.includes("foreign key")) {
        toast.error("لا يمكن حذف النموذج لوجود طلبات مرتبطة به");
      } else {
        toast.error("حدث خطأ أثناء الحذف");
      }
    },
  });

  const handleDeleteType = () => {
    if (!selectedType) return;
    if (confirm(`هل أنت متأكد من حذف نموذج "${selectedType.name_ar}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
      deleteTypeMutation.mutate(selectedType.id);
    }
  };

  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const createTypeMutation = useMutation({
    mutationFn: async (data: Partial<RequestType>) => {
      const { error } = await supabase
        .from("hr_request_types")
        .insert({
          name: data.name_ar || "new_type",
          name_ar: data.name_ar,
          description: data.description,
          icon: data.icon || "FileText",
          color: data.color || "bg-blue-500",
          requires_attachment: data.requires_attachment || false,
          deducts_from_balance: data.deducts_from_balance || false,
          max_days: data.max_days,
          is_active: true,
          letterhead_url: data.letterhead_url,
          header_text: data.header_text,
          greeting_text: data.greeting_text,
          body_template: data.body_template,
          closing_text: data.closing_text,
          custom_fields: data.custom_fields as any || [],
          workflow_stages: data.workflow_stages as any || [],
          show_dates: data.show_dates ?? true,
          show_reason: data.show_reason ?? true,
          show_notes: data.show_notes ?? true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء النموذج بنجاح");
      queryClient.invalidateQueries({ queryKey: ["hr-request-types-full"] });
      queryClient.invalidateQueries({ queryKey: ["hr-request-types"] });
      setIsCreatingNew(false);
      setIsEditing(false);
      setSelectedType(null);
    },
    onError: (error) => {
      console.error("Error creating type:", error);
      toast.error("حدث خطأ أثناء الإنشاء");
    },
  });

  const handleCreateNew = () => {
    setSelectedType(null);
    setEditData({
      name_ar: "",
      description: "",
      icon: "FileText",
      color: "bg-blue-500",
      show_dates: true,
      show_reason: true,
      show_notes: true,
      requires_attachment: false,
      deducts_from_balance: false,
      custom_fields: [],
      workflow_stages: [],
    });
    setIsEditing(true);
    setIsCreatingNew(true);
  };

  const handleSaveNew = () => {
    if (!editData.name_ar) {
      toast.error("يرجى إدخال اسم النموذج");
      return;
    }
    createTypeMutation.mutate(editData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6" dir="rtl" style={{ direction: 'rtl', textAlign: 'right' }}>
        {/* Header */}
        <div className="flex flex-row-reverse items-center justify-between">
          <Button
            onClick={handleCreateNew}
            className="bg-gradient-to-l from-accent to-teal-500 hover:from-accent/90 hover:to-teal-500/90 text-white gap-2 flex-row-reverse"
          >
            إضافة نموذج جديد
            <Plus className="w-4 h-4" />
          </Button>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-foreground">إدارة النماذج</h1>
            <p className="text-muted-foreground">تخصيص قوالب ومسارات طلبات الموارد البشرية</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" style={{ direction: 'rtl' }}>
          {/* محرر النموذج - يظهر على اليسار */}
          <Card className="lg:col-span-3 lg:order-2">
            {isEditing ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between" dir="rtl">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {isCreatingNew ? "إنشاء نموذج جديد" : `تحرير: ${editData.name_ar}`}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={isCreatingNew ? handleSaveNew : handleSave}
                      disabled={updateTypeMutation.isPending || createTypeMutation.isPending}
                      className="bg-gradient-to-l from-accent to-teal-500"
                    >
                      <Save className="w-4 h-4 ml-2" />
                      {isCreatingNew ? "إنشاء النموذج" : "حفظ التعديلات"}
                    </Button>
                    {!isCreatingNew && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(true)}
                      >
                        <Eye className="w-4 h-4 ml-2" />
                        معاينة
                      </Button>
                    )}
                    {!isCreatingNew && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteType}
                        disabled={deleteTypeMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        حذف
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setIsCreatingNew(false);
                        setSelectedType(null);
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* مربع التعليمات الذكية */}
                  <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                          <Wand2 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm font-semibold">التعليمات الذكية</Label>
                          <Textarea
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                            placeholder="اكتب تعليماتك هنا... مثال: أضف حقل لرقم الجوال، اجعل نص الختام رسمي، أضف مرحلة موافقة من المدير المباشر..."
                            className="min-h-[80px] text-right"
                            dir="rtl"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              اكتب ما تريد تطبيقه وسيتم تنفيذه تلقائياً
                            </p>
                            <Button
                              size="sm"
                              onClick={handleApplyAIInstruction}
                              disabled={isApplyingAI || !aiInstruction.trim()}
                              className="bg-gradient-to-r from-primary to-accent gap-2"
                            >
                              {isApplyingAI ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              تطبيق التعليمات
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
                    <TabsList className="grid w-full grid-cols-5" style={{ direction: 'rtl' }}>
                      <TabsTrigger value="content" className="gap-2 flex-row-reverse">
                        المحتوى
                        <Type className="w-4 h-4" />
                      </TabsTrigger>
                      <TabsTrigger value="template" className="gap-2 flex-row-reverse">
                        القالب
                        <Image className="w-4 h-4" />
                      </TabsTrigger>
                      <TabsTrigger value="letterhead" className="gap-2 flex-row-reverse">
                        الكليشيه
                        <Settings className="w-4 h-4" />
                      </TabsTrigger>
                      <TabsTrigger value="fields" className="gap-2 flex-row-reverse">
                        الحقول
                        <List className="w-4 h-4" />
                      </TabsTrigger>
                      <TabsTrigger value="workflow" className="gap-2 flex-row-reverse">
                        المسار
                        <Workflow className="w-4 h-4" />
                      </TabsTrigger>
                    </TabsList>

                    {/* تبويب المحتوى */}
                    <TabsContent value="content" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>اسم النموذج</Label>
                        <Input
                          value={editData.name_ar || ""}
                          onChange={(e) => setEditData(prev => ({ ...prev, name_ar: e.target.value }))}
                          placeholder="مثال: إجازة اعتيادية"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>الوصف</Label>
                        <Textarea
                          value={editData.description || ""}
                          onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Switch
                            checked={editData.show_dates ?? true}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, show_dates: checked }))}
                          />
                          <Label>إظهار التواريخ</Label>
                        </div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Switch
                            checked={editData.show_reason ?? true}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, show_reason: checked }))}
                          />
                          <Label>إظهار السبب</Label>
                        </div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Switch
                            checked={editData.show_notes ?? true}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, show_notes: checked }))}
                          />
                          <Label>إظهار الملاحظات</Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Switch
                            checked={editData.requires_attachment ?? false}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, requires_attachment: checked }))}
                          />
                          <Label>يتطلب مرفق</Label>
                        </div>
                        <div className="flex items-center gap-3 p-3 border rounded-lg">
                          <Switch
                            checked={editData.deducts_from_balance ?? false}
                            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, deducts_from_balance: checked }))}
                          />
                          <Label>يخصم من الرصيد</Label>
                        </div>
                      </div>

                      {editData.deducts_from_balance && (
                        <div className="space-y-2">
                          <Label>الحد الأقصى للأيام</Label>
                          <Input
                            type="number"
                            value={editData.max_days || ""}
                            onChange={(e) => setEditData(prev => ({ ...prev, max_days: parseInt(e.target.value) || null }))}
                          />
                        </div>
                      )}
                    </TabsContent>

                    {/* تبويب القالب */}
                    <TabsContent value="template" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>صورة الخلفية / الورق الرسمي</Label>
                        <div className="border-2 border-dashed rounded-lg p-6">
                          {editData.letterhead_url ? (
                            <div className="relative">
                              <img
                                src={editData.letterhead_url}
                                alt="الخلفية"
                                className="max-h-60 mx-auto rounded shadow-lg"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 left-2"
                                onClick={() => setEditData(prev => ({ ...prev, letterhead_url: null }))}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-3 py-8">
                              <Upload className="w-12 h-12 text-muted-foreground" />
                              <span className="text-base font-medium text-muted-foreground">اضغط لرفع صورة الخلفية</span>
                              <span className="text-sm text-muted-foreground">PNG, JPG, JPEG</span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadLetterhead(file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          إذا لم يتم تحديد خلفية، سيتم استخدام الخلفية الافتراضية
                        </p>
                      </div>
                    </TabsContent>

                    {/* تبويب ضبط الكليشيه */}
                    <TabsContent value="letterhead" className="space-y-4 mt-4">
                      <LetterheadAdjuster
                        letterheadUrl={editData.letterhead_url}
                        initialOffset={Number(editData.header_offset ?? 25) || 25}
                        onSave={(offset) => {
                          setEditData(prev => ({ ...prev, header_offset: offset }));
                          toast.success("تم حفظ موضع الكليشيه");
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="fields" className="space-y-4 mt-4">
                      {/* الحقول الموجودة */}
                      <div className="space-y-2">
                        <Label>الحقول المخصصة</Label>
                        {(editData.custom_fields?.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                            لا توجد حقول مخصصة. أضف حقولاً جديدة أدناه.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {editData.custom_fields?.map((field) => (
                              <div
                                key={field.id}
                                className="flex items-center gap-3 p-3 border rounded-lg"
                              >
                                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                                <div className="flex items-center gap-2">
                                  {fieldTypeIcons[field.type]}
                                  <span className="text-xs text-muted-foreground">
                                    {fieldTypeLabels[field.type]}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{field.label}</p>
                                  <p className="text-xs text-muted-foreground">{field.name}</p>
                                </div>
                                {field.required && (
                                  <Badge variant="destructive" className="text-[10px]">مطلوب</Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveField(field.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* إضافة حقل جديد */}
                      <Card className="border-dashed">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            إضافة حقل جديد
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">اسم الحقل (بالإنجليزي)</Label>
                              <Input
                                value={newField.name || ""}
                                onChange={(e) => setNewField(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="field_name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">المسمى (بالعربي)</Label>
                              <Input
                                value={newField.label || ""}
                                onChange={(e) => setNewField(prev => ({ ...prev, label: e.target.value }))}
                                placeholder="اسم الحقل"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">نوع الحقل</Label>
                              <Select
                                value={newField.type}
                                onValueChange={(v) => setNewField(prev => ({ ...prev, type: v as any }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(fieldTypeLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                      <div className="flex items-center gap-2">
                                        {fieldTypeIcons[key]}
                                        {label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {newField.type === "select" && (
                            <div className="space-y-1">
                              <Label className="text-xs">الخيارات (مفصولة بفاصلة)</Label>
                              <Input
                                value={newField.options?.join(", ") || ""}
                                onChange={(e) => setNewField(prev => ({ 
                                  ...prev, 
                                  options: e.target.value.split(",").map(o => o.trim()).filter(Boolean)
                                }))}
                                placeholder="خيار 1, خيار 2, خيار 3"
                              />
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={newField.required ?? false}
                                onCheckedChange={(checked) => setNewField(prev => ({ ...prev, required: checked }))}
                              />
                              <Label className="text-sm">حقل مطلوب</Label>
                            </div>
                            <Button size="sm" onClick={handleAddField}>
                              <Plus className="w-4 h-4 ml-2" />
                              إضافة الحقل
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* تبويب مسار الموافقات */}
                    <TabsContent value="workflow" className="space-y-4 mt-4">
                      {/* المراحل الموجودة */}
                      <div className="space-y-2">
                        <Label>مراحل سير العمل</Label>
                        {(editData.workflow_stages?.length ?? 0) === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                            لا توجد مراحل. سيتم الموافقة مباشرة من المدير.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {editData.workflow_stages?.map((stage, index) => (
                              <div
                                key={stage.id}
                                className="flex items-center gap-3 p-3 border rounded-lg"
                              >
                                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{stage.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {stage.approverRole === "admin" && "المدراء"}
                                    {stage.approverRole === "moderator" && "المشرفون"}
                                    {stage.approverRole === "specific_user" && 
                                      employees.find(e => e.user_id === stage.approverUserId)?.full_name
                                    }
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  {stage.isRequired && (
                                    <Badge variant="outline" className="text-[10px]">مطلوبة</Badge>
                                  )}
                                  {stage.canReject && (
                                    <Badge variant="outline" className="text-[10px]">يمكن الرفض</Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveStage(stage.id)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* إضافة مرحلة جديدة */}
                      <Card className="border-dashed">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            إضافة مرحلة جديدة
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">اسم المرحلة</Label>
                              <Input
                                value={newStage.name || ""}
                                onChange={(e) => setNewStage(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="مثال: موافقة المدير المباشر"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">المعتمد</Label>
                              <Select
                                value={newStage.approverRole}
                                onValueChange={(v) => setNewStage(prev => ({ ...prev, approverRole: v as any }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">المدراء</SelectItem>
                                  <SelectItem value="moderator">المشرفون</SelectItem>
                                  <SelectItem value="specific_user">موظف محدد</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {newStage.approverRole === "specific_user" && (
                            <div className="space-y-1">
                              <Label className="text-xs">اختر الموظف</Label>
                              <Select
                                value={newStage.approverUserId}
                                onValueChange={(v) => setNewStage(prev => ({ ...prev, approverUserId: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="اختر..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {employees.map((emp) => (
                                    <SelectItem key={emp.user_id} value={emp.user_id!}>
                                      {emp.full_name} - {emp.job_role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex gap-4">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={newStage.isRequired ?? true}
                                  onCheckedChange={(checked) => setNewStage(prev => ({ ...prev, isRequired: checked }))}
                                />
                                <Label className="text-sm">مرحلة مطلوبة</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={newStage.canReject ?? true}
                                  onCheckedChange={(checked) => setNewStage(prev => ({ ...prev, canReject: checked }))}
                                />
                                <Label className="text-sm">يمكن الرفض</Label>
                              </div>
                            </div>
                            <Button size="sm" onClick={handleAddStage}>
                              <Plus className="w-4 h-4 ml-2" />
                              إضافة المرحلة
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Settings className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">اختر نوع طلب للتحرير</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  اختر أحد أنواع الطلبات من القائمة لتخصيص القالب والحقول ومسار الموافقات
                </p>
              </CardContent>
            )}
          </Card>

          {/* قائمة أنواع الطلبات - تظهر على اليمين */}
          <Card className="lg:col-span-1 lg:order-1">
            <CardHeader className="pb-3 px-6">
              <CardTitle className="text-lg grid grid-cols-[auto_1fr] gap-3 items-center" dir="rtl">
                <div className="w-10 h-10 flex items-center justify-center">
                  <List className="w-5 h-5" />
                </div>
                <span>أنواع الطلبات</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <p className="text-muted-foreground text-center py-4">جاري التحميل...</p>
              ) : (
                requestTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      handleSelectType(type);
                      setIsCreatingNew(false);
                    }}
                    className={`w-full p-3 rounded-lg border text-right transition-all ${
                      selectedType?.id === type.id
                        ? "border-accent bg-accent/10"
                        : "border-border hover:border-accent/50"
                    }`}
                  >
                    <div className="grid grid-cols-[auto_1fr] gap-3 items-center" dir="rtl">
                      <div
                        className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center shrink-0`}
                      >
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="font-semibold text-sm truncate">{type.name_ar}</p>
                        {(type.custom_fields?.length > 0 || type.workflow_stages?.length > 0) && (
                          <div className="flex flex-wrap justify-end gap-1 mt-1">
                            {type.custom_fields?.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                {type.custom_fields.length} حقول
                              </Badge>
                            )}
                            {type.workflow_stages?.length > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                {type.workflow_stages.length} مراحل
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* معاينة القالب */}
      {showPreview && selectedType && (
        <TemplatePreview
          open={showPreview}
          onOpenChange={setShowPreview}
          templateData={editData}
        />
      )}
    </DashboardLayout>
  );
}
