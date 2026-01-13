import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { 
  Type, 
  Hash, 
  Calendar, 
  Building2, 
  User,
  Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddCustomColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ColumnType = "text" | "number" | "date" | "department" | "employee";

const COLUMN_TYPES: { value: ColumnType; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: "text", 
    label: "نص", 
    icon: <Type className="w-5 h-5" />,
    description: "حقل نصي حر"
  },
  { 
    value: "number", 
    label: "رقم", 
    icon: <Hash className="w-5 h-5" />,
    description: "قيمة رقمية"
  },
  { 
    value: "date", 
    label: "تاريخ", 
    icon: <Calendar className="w-5 h-5" />,
    description: "تاريخ محدد"
  },
  { 
    value: "department", 
    label: "قسم", 
    icon: <Building2 className="w-5 h-5" />,
    description: "اختيار من الأقسام"
  },
  { 
    value: "employee", 
    label: "موظف", 
    icon: <User className="w-5 h-5" />,
    description: "اختيار من الموظفين"
  },
];

export function AddCustomColumnDialog({ 
  open, 
  onOpenChange,
  onSuccess 
}: AddCustomColumnDialogProps) {
  const [name, setName] = useState("");
  const [columnType, setColumnType] = useState<ColumnType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("يرجى إدخال اسم العمود");
      return;
    }

    setIsSubmitting(true);
    try {
      // الحصول على أعلى ترتيب حالي
      const { data: existingColumns } = await supabase
        .from("operational_plan_custom_columns")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingColumns?.[0]?.display_order ?? -1) + 1;

      const { error } = await supabase
        .from("operational_plan_custom_columns")
        .insert({
          name: name.trim(),
          column_type: columnType,
          is_required: isRequired,
          display_order: nextOrder,
        });

      if (error) throw error;

      toast.success("تم إضافة العمود بنجاح");
      setName("");
      setColumnType("text");
      setIsRequired(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error adding column:", error);
      toast.error("حدث خطأ أثناء إضافة العمود");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Plus className="w-5 h-5 text-primary" />
            إضافة عمود جديد
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* اسم العمود */}
          <div className="space-y-2">
            <Label htmlFor="column-name">اسم العمود</Label>
            <Input
              id="column-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: ملاحظات، تاريخ البدء..."
              className="text-right"
            />
          </div>

          {/* نوع العمود */}
          <div className="space-y-3">
            <Label>نوع العمود</Label>
            <RadioGroup
              value={columnType}
              onValueChange={(v) => setColumnType(v as ColumnType)}
              className="grid grid-cols-1 gap-2"
            >
              {COLUMN_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    columnType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setColumnType(type.value)}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                  <div className={`p-2 rounded-lg ${
                    columnType === type.value ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                    {type.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* حقل مطلوب */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div>
              <Label htmlFor="is-required" className="font-medium">حقل مطلوب</Label>
              <p className="text-xs text-muted-foreground">يجب تعبئة هذا الحقل لكل نشاط</p>
            </div>
            <Switch
              id="is-required"
              checked={isRequired}
              onCheckedChange={setIsRequired}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? "جاري الإضافة..." : "إضافة العمود"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
