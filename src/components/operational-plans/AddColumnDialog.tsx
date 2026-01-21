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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Type, 
  Hash, 
  Calendar, 
  Building2, 
  User,
  Plus,
  Calculator,
  List,
  Percent,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  color?: string;
}

export type ColumnContentType = 
  | "text" 
  | "number" 
  | "date" 
  | "employee" 
  | "employee_department" 
  | "formula" 
  | "dropdown"
  | "percentage";

interface FormulaConfig {
  operation: "sum" | "subtract" | "multiply" | "divide" | "average";
  sourceColumns: string[];
}

interface DropdownConfig {
  options: string[];
}

export interface ColumnConfig {
  id: string;
  label: string;
  width: string;
  editable: boolean;
  removable: boolean;
  isCustom: boolean;
  contentType: ColumnContentType;
  departmentId?: string; // للموظفين من قسم معين
  formulaConfig?: FormulaConfig;
  dropdownConfig?: DropdownConfig;
  isRequired?: boolean;
}

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (config: ColumnConfig) => void;
  departments: Department[];
  existingColumns: { id: string; label: string }[];
}

const COLUMN_TYPES: { 
  value: ColumnContentType; 
  label: string; 
  icon: React.ReactNode; 
  description: string;
}[] = [
  { 
    value: "text", 
    label: "نص", 
    icon: <Type className="w-5 h-5" />,
    description: "حقل نصي حر للكتابة"
  },
  { 
    value: "number", 
    label: "رقم", 
    icon: <Hash className="w-5 h-5" />,
    description: "قيمة رقمية صحيحة أو عشرية"
  },
  { 
    value: "percentage", 
    label: "نسبة مئوية", 
    icon: <Percent className="w-5 h-5" />,
    description: "نسبة مئوية من 0% إلى 100%"
  },
  { 
    value: "date", 
    label: "تاريخ", 
    icon: <Calendar className="w-5 h-5" />,
    description: "تاريخ محدد"
  },
  { 
    value: "employee", 
    label: "موظف (الكل)", 
    icon: <User className="w-5 h-5" />,
    description: "اختيار موظف من جميع الموظفين"
  },
  { 
    value: "employee_department", 
    label: "موظف (قسم محدد)", 
    icon: <Building2 className="w-5 h-5" />,
    description: "اختيار موظف من قسم معين"
  },
  { 
    value: "formula", 
    label: "عملية حسابية", 
    icon: <Calculator className="w-5 h-5" />,
    description: "نتيجة عملية حسابية على أعمدة أخرى"
  },
  { 
    value: "dropdown", 
    label: "قائمة خيارات", 
    icon: <List className="w-5 h-5" />,
    description: "اختيار من قائمة محددة مسبقاً"
  },
];

const FORMULA_OPERATIONS = [
  { value: "sum", label: "جمع (+)" },
  { value: "subtract", label: "طرح (-)" },
  { value: "multiply", label: "ضرب (×)" },
  { value: "divide", label: "قسمة (÷)" },
  { value: "average", label: "متوسط" },
];

export function AddColumnDialog({ 
  open, 
  onOpenChange,
  onAdd,
  departments,
  existingColumns,
}: AddColumnDialogProps) {
  const [name, setName] = useState("");
  const [contentType, setContentType] = useState<ColumnContentType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [formulaOperation, setFormulaOperation] = useState<string>("sum");
  const [selectedSourceColumns, setSelectedSourceColumns] = useState<string[]>([]);
  const [dropdownOptions, setDropdownOptions] = useState<string>("");

  const handleSubmit = () => {
    if (!name.trim()) return;

    const generateId = () => `custom_${Math.random().toString(36).substr(2, 9)}`;

    const config: ColumnConfig = {
      id: generateId(),
      label: name.trim(),
      width: '12%',
      editable: true,
      removable: true,
      isCustom: true,
      contentType,
      isRequired,
    };

    if (contentType === "employee_department" && selectedDepartmentId) {
      config.departmentId = selectedDepartmentId;
    }

    if (contentType === "formula") {
      config.formulaConfig = {
        operation: formulaOperation as FormulaConfig["operation"],
        sourceColumns: selectedSourceColumns,
      };
      config.editable = false; // الأعمدة الحسابية للقراءة فقط
    }

    if (contentType === "dropdown" && dropdownOptions.trim()) {
      config.dropdownConfig = {
        options: dropdownOptions.split('\n').map(o => o.trim()).filter(o => o),
      };
    }

    onAdd(config);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName("");
    setContentType("text");
    setIsRequired(false);
    setSelectedDepartmentId("");
    setFormulaOperation("sum");
    setSelectedSourceColumns([]);
    setDropdownOptions("");
  };

  const toggleSourceColumn = (colId: string) => {
    setSelectedSourceColumns(prev => 
      prev.includes(colId) 
        ? prev.filter(id => id !== colId)
        : [...prev, colId]
    );
  };

  // فلترة الأعمدة الرقمية فقط للعمليات الحسابية
  const numericColumns = existingColumns.filter(col => 
    col.id === 'annualTarget' || 
    col.id === 'monthlyAverage' ||
    col.id.startsWith('custom_')
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
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

          {/* نوع المحتوى */}
          <div className="space-y-3">
            <Label>نوع المحتوى</Label>
            <RadioGroup
              value={contentType}
              onValueChange={(v) => setContentType(v as ColumnContentType)}
              className="grid grid-cols-1 gap-2"
            >
              {COLUMN_TYPES.map((type) => (
                <div
                  key={type.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    contentType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setContentType(type.value)}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                  <div className={`p-2 rounded-lg ${
                    contentType === type.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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

          {/* خيارات إضافية حسب النوع */}
          {contentType === "employee_department" && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
              <Label>اختر القسم</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم..." />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {contentType === "formula" && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label>نوع العملية</Label>
                <Select value={formulaOperation} onValueChange={setFormulaOperation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMULA_OPERATIONS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>الأعمدة المصدر (اختر أكثر من عمود)</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {numericColumns.map((col) => (
                    <label 
                      key={col.id} 
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSourceColumns.includes(col.id)}
                        onChange={() => toggleSourceColumn(col.id)}
                        className="rounded"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
                {selectedSourceColumns.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    العملية: {FORMULA_OPERATIONS.find(o => o.value === formulaOperation)?.label} على ({selectedSourceColumns.length} أعمدة)
                  </p>
                )}
              </div>
            </div>
          )}

          {contentType === "dropdown" && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
              <Label>خيارات القائمة (كل خيار في سطر)</Label>
              <textarea
                value={dropdownOptions}
                onChange={(e) => setDropdownOptions(e.target.value)}
                placeholder={"مثال:\nمكتمل\nجاري التنفيذ\nمتأخر\nلم يبدأ"}
                className="w-full h-24 p-2 text-sm border rounded-md resize-none"
                dir="rtl"
              />
            </div>
          )}

          {/* حقل مطلوب */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="is-required" className="font-medium">حقل مطلوب</Label>
              <p className="text-xs text-muted-foreground">يجب تعبئة هذا الحقل لكل صف</p>
            </div>
            <Switch
              id="is-required"
              checked={isRequired}
              onCheckedChange={setIsRequired}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            إلغاء
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name.trim() || (contentType === "employee_department" && !selectedDepartmentId) || (contentType === "formula" && selectedSourceColumns.length < 2)}
          >
            إضافة العمود
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
