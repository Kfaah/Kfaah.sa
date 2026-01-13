import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Type, 
  Hash, 
  Calendar, 
  Building2, 
  User,
  GripVertical,
  Trash2,
  Plus,
  Settings2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddCustomColumnDialog } from "./AddCustomColumnDialog";

interface CustomColumn {
  id: string;
  name: string;
  column_type: "text" | "number" | "date" | "department" | "employee";
  display_order: number;
  is_required: boolean;
  is_active: boolean;
}

interface ManageCustomColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnsChange: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  department: <Building2 className="w-4 h-4" />,
  employee: <User className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  text: "نص",
  number: "رقم",
  date: "تاريخ",
  department: "قسم",
  employee: "موظف",
};

export function ManageCustomColumnsDialog({ 
  open, 
  onOpenChange,
  onColumnsChange 
}: ManageCustomColumnsDialogProps) {
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const fetchColumns = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("operational_plan_custom_columns")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setColumns(data || []);
    } catch (error) {
      console.error("Error fetching columns:", error);
      toast.error("حدث خطأ في جلب الأعمدة");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchColumns();
    }
  }, [open]);

  const handleToggleActive = async (column: CustomColumn) => {
    try {
      const { error } = await supabase
        .from("operational_plan_custom_columns")
        .update({ is_active: !column.is_active })
        .eq("id", column.id);

      if (error) throw error;

      setColumns(prev =>
        prev.map(c =>
          c.id === column.id ? { ...c, is_active: !c.is_active } : c
        )
      );
      onColumnsChange();
    } catch (error) {
      console.error("Error toggling column:", error);
      toast.error("حدث خطأ في تحديث العمود");
    }
  };

  const handleDeleteColumn = async (column: CustomColumn) => {
    if (!confirm(`هل أنت متأكد من حذف العمود "${column.name}"؟ سيتم حذف جميع البيانات المرتبطة به.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("operational_plan_custom_columns")
        .delete()
        .eq("id", column.id);

      if (error) throw error;

      toast.success("تم حذف العمود بنجاح");
      setColumns(prev => prev.filter(c => c.id !== column.id));
      onColumnsChange();
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("حدث خطأ في حذف العمود");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Settings2 className="w-5 h-5 text-primary" />
              إدارة الأعمدة المخصصة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* زر إضافة عمود جديد */}
            <Button
              variant="outline"
              className="w-full justify-center gap-2 border-dashed"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4" />
              إضافة عمود جديد
            </Button>

            {/* قائمة الأعمدة */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                جاري التحميل...
              </div>
            ) : columns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد أعمدة مخصصة بعد
              </div>
            ) : (
              <div className="space-y-2">
                {columns.map((column) => (
                  <div
                    key={column.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      column.is_active
                        ? "bg-white border-gray-200"
                        : "bg-gray-50 border-gray-100 opacity-60"
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                    
                    <div className={`p-2 rounded-lg ${
                      column.is_active ? "bg-primary/10 text-primary" : "bg-gray-200 text-gray-500"
                    }`}>
                      {TYPE_ICONS[column.column_type]}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{column.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[column.column_type]}
                        {column.is_required && " • مطلوب"}
                      </p>
                    </div>

                    <Switch
                      checked={column.is_active}
                      onCheckedChange={() => handleToggleActive(column)}
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:bg-red-50"
                      onClick={() => handleDeleteColumn(column)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AddCustomColumnDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          fetchColumns();
          onColumnsChange();
        }}
      />
    </>
  );
}
