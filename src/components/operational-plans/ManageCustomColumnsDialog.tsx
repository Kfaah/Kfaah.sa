import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Type, 
  Hash, 
  Calendar, 
  Building2, 
  User,
  Trash2,
  Plus,
  Settings2,
  ArrowRight,
  ArrowLeft,
  Pencil,
  Check,
  X,
  Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddCustomColumnDialog } from "./AddCustomColumnDialog";

interface ColumnOrder {
  id: string;
  column_key: string;
  column_name: string;
  display_order: number;
  is_visible: boolean;
  is_standard: boolean;
}

interface ManageCustomColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnsChange: () => void;
}

const STANDARD_ICONS: Record<string, React.ReactNode> = {
  strategic_goal: <Lock className="w-4 h-4" />,
  initiative: <Lock className="w-4 h-4" />,
  activity: <Lock className="w-4 h-4" />,
  responsible_employee: <User className="w-4 h-4" />,
  annual_target: <Hash className="w-4 h-4" />,
  monthly_average: <Hash className="w-4 h-4" />,
};

const CUSTOM_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  department: <Building2 className="w-4 h-4" />,
  employee: <User className="w-4 h-4" />,
};

export function ManageCustomColumnsDialog({ 
  open, 
  onOpenChange,
  onColumnsChange 
}: ManageCustomColumnsDialogProps) {
  const [columns, setColumns] = useState<ColumnOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchColumns = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("operational_plan_column_order")
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

  const handleToggleVisible = async (column: ColumnOrder) => {
    // لا يمكن إخفاء الأعمدة الأساسية الثلاثة الأولى
    if (column.is_standard && ['strategic_goal', 'initiative', 'activity'].includes(column.column_key)) {
      toast.error("لا يمكن إخفاء هذا العمود");
      return;
    }

    try {
      const { error } = await supabase
        .from("operational_plan_column_order")
        .update({ is_visible: !column.is_visible })
        .eq("id", column.id);

      if (error) throw error;

      setColumns(prev =>
        prev.map(c =>
          c.id === column.id ? { ...c, is_visible: !c.is_visible } : c
        )
      );
      onColumnsChange();
    } catch (error) {
      console.error("Error toggling column:", error);
      toast.error("حدث خطأ في تحديث العمود");
    }
  };

  const handleDeleteColumn = async (column: ColumnOrder) => {
    if (column.is_standard) {
      toast.error("لا يمكن حذف الأعمدة الأساسية");
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف العمود "${column.column_name}"؟ سيتم حذف جميع البيانات المرتبطة به.`)) {
      return;
    }

    try {
      // Delete from custom columns table
      const { error: customError } = await supabase
        .from("operational_plan_custom_columns")
        .delete()
        .eq("id", column.column_key);

      if (customError) throw customError;

      // Delete from column order table
      const { error } = await supabase
        .from("operational_plan_column_order")
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

  const handleStartEdit = (column: ColumnOrder) => {
    if (column.is_standard) {
      toast.error("لا يمكن تعديل اسم الأعمدة الأساسية");
      return;
    }
    setEditingColumnId(column.id);
    setEditingName(column.column_name);
  };

  const handleSaveEdit = async (column: ColumnOrder) => {
    if (!editingName.trim()) {
      toast.error("يجب إدخال اسم العمود");
      return;
    }

    try {
      // Update in column order table
      const { error: orderError } = await supabase
        .from("operational_plan_column_order")
        .update({ column_name: editingName.trim() })
        .eq("id", column.id);

      if (orderError) throw orderError;

      // Update in custom columns table if not standard
      if (!column.is_standard) {
        const { error: customError } = await supabase
          .from("operational_plan_custom_columns")
          .update({ name: editingName.trim() })
          .eq("id", column.column_key);

        if (customError) throw customError;
      }

      setColumns(prev =>
        prev.map(c =>
          c.id === column.id ? { ...c, column_name: editingName.trim() } : c
        )
      );
      setEditingColumnId(null);
      setEditingName("");
      toast.success("تم تحديث اسم العمود");
      onColumnsChange();
    } catch (error) {
      console.error("Error updating column name:", error);
      toast.error("حدث خطأ في تحديث اسم العمود");
    }
  };

  const handleCancelEdit = () => {
    setEditingColumnId(null);
    setEditingName("");
  };

  const handleMoveRight = async (index: number) => {
    if (index === 0) return;

    const newColumns = [...columns];
    const temp = newColumns[index];
    newColumns[index] = newColumns[index - 1];
    newColumns[index - 1] = temp;

    try {
      const updates = [
        supabase
          .from("operational_plan_column_order")
          .update({ display_order: index - 1 })
          .eq("id", temp.id),
        supabase
          .from("operational_plan_column_order")
          .update({ display_order: index })
          .eq("id", columns[index - 1].id),
      ];

      await Promise.all(updates);

      setColumns(newColumns.map((col, i) => ({ ...col, display_order: i })));
      onColumnsChange();
    } catch (error) {
      console.error("Error reordering columns:", error);
      toast.error("حدث خطأ في ترتيب الأعمدة");
    }
  };

  const handleMoveLeft = async (index: number) => {
    if (index === columns.length - 1) return;

    const newColumns = [...columns];
    const temp = newColumns[index];
    newColumns[index] = newColumns[index + 1];
    newColumns[index + 1] = temp;

    try {
      const updates = [
        supabase
          .from("operational_plan_column_order")
          .update({ display_order: index + 1 })
          .eq("id", temp.id),
        supabase
          .from("operational_plan_column_order")
          .update({ display_order: index })
          .eq("id", columns[index + 1].id),
      ];

      await Promise.all(updates);

      setColumns(newColumns.map((col, i) => ({ ...col, display_order: i })));
      onColumnsChange();
    } catch (error) {
      console.error("Error reordering columns:", error);
      toast.error("حدث خطأ في ترتيب الأعمدة");
    }
  };

  const getColumnIcon = (column: ColumnOrder) => {
    if (column.is_standard) {
      return STANDARD_ICONS[column.column_key] || <Lock className="w-4 h-4" />;
    }
    return CUSTOM_TYPE_ICONS.text; // Default for custom columns
  };

  const handleAddSuccess = async () => {
    // Sync new custom columns to column order table
    try {
      const { data: customCols } = await supabase
        .from("operational_plan_custom_columns")
        .select("id, name")
        .eq("is_active", true);

      const { data: existingOrder } = await supabase
        .from("operational_plan_column_order")
        .select("column_key");

      const existingKeys = new Set((existingOrder || []).map(o => o.column_key));
      const maxOrder = columns.length;

      for (const col of customCols || []) {
        if (!existingKeys.has(col.id)) {
          await supabase
            .from("operational_plan_column_order")
            .insert({
              column_key: col.id,
              column_name: col.name,
              display_order: maxOrder,
              is_visible: true,
              is_standard: false
            });
        }
      }

      fetchColumns();
      onColumnsChange();
    } catch (error) {
      console.error("Error syncing columns:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Settings2 className="w-5 h-5 text-primary" />
              إدارة أعمدة الجدول
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
              إضافة عمود مخصص جديد
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              استخدم الأسهم لتغيير ترتيب الأعمدة • الأعمدة الأساسية لا يمكن حذفها
            </p>

            {/* قائمة الأعمدة */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                جاري التحميل...
              </div>
            ) : columns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد أعمدة
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {columns.map((column, index) => (
                  <div
                    key={column.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      column.is_visible
                        ? column.is_standard 
                          ? "bg-blue-50/50 border-blue-200"
                          : "bg-white border-gray-200"
                        : "bg-gray-50 border-gray-100 opacity-60"
                    }`}
                  >
                    {/* أزرار الترتيب */}
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-primary hover:bg-primary/10"
                        onClick={() => handleMoveRight(index)}
                        disabled={index === 0}
                        title="تحريك لليمين"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-primary hover:bg-primary/10"
                        onClick={() => handleMoveLeft(index)}
                        disabled={index === columns.length - 1}
                        title="تحريك لليسار"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className={`p-2 rounded-lg ${
                      column.is_visible 
                        ? column.is_standard
                          ? "bg-blue-100 text-blue-600"
                          : "bg-primary/10 text-primary" 
                        : "bg-gray-200 text-gray-500"
                    }`}>
                      {getColumnIcon(column)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {editingColumnId === column.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(column);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600 hover:bg-green-50"
                            onClick={() => handleSaveEdit(column)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:bg-red-50"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-sm truncate">{column.column_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {column.is_standard ? "عمود أساسي" : "عمود مخصص"}
                          </p>
                        </>
                      )}
                    </div>

                    {editingColumnId !== column.id && (
                      <>
                        {!column.is_standard && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleStartEdit(column)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}

                        <Switch
                          checked={column.is_visible}
                          onCheckedChange={() => handleToggleVisible(column)}
                          disabled={column.is_standard && ['strategic_goal', 'initiative', 'activity'].includes(column.column_key)}
                        />

                        {!column.is_standard && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={() => handleDeleteColumn(column)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
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
        onSuccess={handleAddSuccess}
      />
    </>
  );
}
