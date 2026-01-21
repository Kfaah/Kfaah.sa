import { useState, useEffect } from "react";
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
import { 
  Pencil, 
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  editable: boolean;
  removable: boolean;
  isCustom: boolean;
}

interface EditColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: ColumnConfig | null;
  onSave: (columnId: string, newLabel: string) => void;
  onDelete: (columnId: string) => void;
}

export function EditColumnDialog({ 
  open, 
  onOpenChange,
  column,
  onSave,
  onDelete,
}: EditColumnDialogProps) {
  const [name, setName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (column) {
      setName(column.label);
    }
  }, [column]);

  const handleSave = () => {
    if (!name.trim() || !column) return;
    onSave(column.id, name.trim());
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!column) return;
    onDelete(column.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  if (!column) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Pencil className="w-5 h-5 text-primary" />
              تعديل العمود
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* اسم العمود */}
            <div className="space-y-2">
              <Label htmlFor="edit-column-name">اسم العمود</Label>
              <Input
                id="edit-column-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم العمود..."
                className="text-right"
                autoFocus
              />
            </div>

            {/* معلومات العمود */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">معرّف العمود:</span> {column.id}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">نوع العمود:</span> {column.isCustom ? "مخصص" : "أساسي"}
              </p>
            </div>

            {/* تحذير الحذف */}
            {column.removable && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">حذف العمود</p>
                    <p className="text-xs text-muted-foreground">
                      سيتم حذف جميع البيانات المرتبطة بهذا العمود بشكل نهائي.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="mt-2 h-8 text-xs gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      حذف العمود
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">تأكيد حذف العمود</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف العمود "{column.label}"؟ سيتم حذف جميع البيانات المرتبطة به بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف العمود
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
