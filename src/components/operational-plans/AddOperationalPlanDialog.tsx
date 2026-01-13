import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus,
  Trash2,
  Users,
  Save,
  Merge,
  SplitSquareHorizontal,
  FileSpreadsheet,
  Columns,
  X,
  GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
}

interface StrategicGoal {
  id: string;
  name: string;
  color: string;
  year: number;
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
}

interface ColumnDef {
  id: string;
  label: string;
  width: string;
  editable: boolean;
  removable: boolean;
  isCustom: boolean;
}

// هيكل دمج الخلايا
interface MergedCell {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  value: string;
}

// هيكل الصف في الجدول
interface TableRowData {
  id: string;
  strategicGoal: string;
  strategicGoalId?: string;
  initiative: string;
  initiativeId?: string;
  activity: string;
  annualTarget: number;
  monthlyAverage: number;
  goalRowSpan: number;
  initiativeRowSpan: number;
  isGoalMerged: boolean;
  isInitiativeMerged: boolean;
  showGoalCell: boolean;
  showInitiativeCell: boolean;
  customColumns: Record<string, string>;
}

// هيكل البيانات للتصدير
interface LocalActivity {
  id: string;
  name: string;
  annualTarget: number;
}

interface LocalInitiative {
  id: string;
  name: string;
  isNew: boolean;
  existingId?: string;
  activities: LocalActivity[];
}

interface LocalGoal {
  id: string;
  name: string;
  isNew: boolean;
  existingId?: string;
  initiatives: LocalInitiative[];
}

interface AddOperationalPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  employees: Employee[];
  strategicGoals: StrategicGoal[];
  initiatives: Initiative[];
  onSubmit: (data: {
    selectedEmployeeId: string;
    goals: LocalGoal[];
    year: number;
  }) => void;
}

// مكون العمود القابل للسحب
function SortableColumnHeader({ 
  column, 
  editingColumn, 
  setEditingColumn, 
  updateColumnLabel, 
  removeColumn 
}: {
  column: ColumnDef;
  editingColumn: string | null;
  setEditingColumn: (id: string | null) => void;
  updateColumnLabel: (id: string, label: string) => void;
  removeColumn: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: column.width,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        "text-center border-l font-bold relative group",
        column.editable && "cursor-pointer hover:bg-muted",
        isDragging && "bg-primary/20"
      )}
      onDoubleClick={() => column.editable && setEditingColumn(column.id)}
    >
      <div className="flex items-center justify-center gap-1">
        {/* مقبض السحب */}
        {column.id !== 'action' && column.id !== 'rowNumber' && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        
        {editingColumn === column.id ? (
          <Input
            value={column.label}
            onChange={(e) => updateColumnLabel(column.id, e.target.value)}
            onBlur={() => setEditingColumn(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingColumn(null)}
            className="h-7 text-center text-sm font-bold border-primary"
            autoFocus
          />
        ) : (
          <>
            <span>{column.label}</span>
            {column.removable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeColumn(column.id);
                }}
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </>
        )}
      </div>
    </TableHead>
  );
}

// مكون الصف القابل للسحب
function SortableRow({ 
  row, 
  index,
  columns,
  selectedRows,
  selectedCells,
  toggleRowSelection,
  toggleCellSelection,
  getMergeInfo,
  removeRow,
  updateCell,
  updateCustomColumn,
}: {
  row: TableRowData;
  index: number;
  columns: ColumnDef[];
  selectedRows: Set<string>;
  selectedCells: Set<string>;
  toggleRowSelection: (id: string) => void;
  toggleCellSelection: (rowId: string, colId: string) => void;
  getMergeInfo: (rowIndex: number, colIndex: number) => {
    isMerged: boolean;
    isFirst: boolean;
    rowSpan: number;
    colSpan: number;
    value: string;
  };
  removeRow: (id: string) => void;
  updateCell: (rowId: string, field: keyof TableRowData, value: string | number) => void;
  updateCustomColumn: (rowId: string, columnId: string, value: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:bg-muted/30",
        selectedRows.has(row.id) && "bg-primary/10 hover:bg-primary/15",
        isDragging && "bg-primary/20"
      )}
    >
      {columns.map((col, colIndex) => {
        const mergeInfo = getMergeInfo(index, colIndex);

        // تطبيق دمج الخلايا (مرئي)
        if (mergeInfo.isMerged) {
          if (!mergeInfo.isFirst) return null;

          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell
              key={`${col.id}-merged-${index}`}
              rowSpan={mergeInfo.rowSpan}
              colSpan={mergeInfo.colSpan}
              className={cn(
                "border-l text-center text-sm font-medium cursor-pointer align-middle",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              {mergeInfo.value || ""}
            </TableCell>
          );
        }
          return (
            <TableCell key={col.id} className="text-center p-1 border-l">
              <div className="flex items-center justify-center gap-1">
                {/* مقبض السحب للصف */}
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-muted rounded"
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.id)}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </TableCell>
          );
        }

        // عمود المتوسط الشهري
        if (col.id === 'monthlyAverage') {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell 
              key={col.id} 
              className={cn(
                "border-l text-center bg-muted/30 text-sm font-medium cursor-pointer",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              {row.monthlyAverage.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
            </TableCell>
          );
        }

        // عمود المستهدف السنوي
        if (col.id === 'annualTarget') {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell 
              key={col.id} 
              className={cn(
                "border-l p-0 cursor-pointer",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              <Input
                type="number"
                value={row.annualTarget || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'annualTarget', parseFloat(e.target.value) || 0);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="0"
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-center text-sm"
              />
            </TableCell>
          );
        }

        // عمود النشاط
        if (col.id === 'activity') {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell 
              key={col.id} 
              className={cn(
                "border-l p-0 cursor-pointer",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              <Input
                value={row.activity}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'activity', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="النشاط..."
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
              />
            </TableCell>
          );
        }

        // عمود المبادرة
        if (col.id === 'initiative') {
          if (!row.showInitiativeCell) return null;
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell 
              key={col.id}
              className={cn(
                "border-l p-0 cursor-pointer",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              rowSpan={row.initiativeRowSpan}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              <Input
                value={row.initiative}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'initiative', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="المبادرة..."
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
                list="initiatives-list"
              />
            </TableCell>
          );
        }

        // عمود الهدف الاستراتيجي
        if (col.id === 'strategicGoal') {
          if (!row.showGoalCell) return null;
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell 
              key={col.id}
              className={cn(
                "border-l p-0 cursor-pointer",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              rowSpan={row.goalRowSpan}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              <Input
                value={row.strategicGoal}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'strategicGoal', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder="الهدف الاستراتيجي..."
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
                list="goals-list"
              />
            </TableCell>
          );
        }

        // عمود رقم الصف
        if (col.id === 'rowNumber') {
          return (
            <TableCell 
              key={col.id}
              className="text-center cursor-pointer select-none font-medium text-muted-foreground hover:bg-muted/50"
              onClick={() => toggleRowSelection(row.id)}
            >
              {index + 1}
            </TableCell>
          );
        }

        // الأعمدة المخصصة
        if (col.isCustom) {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell 
              key={col.id} 
              className={cn(
                "border-l p-0 cursor-pointer",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
              onClick={() => toggleCellSelection(row.id, col.id)}
            >
              <Input
                value={row.customColumns[col.id] || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCustomColumn(row.id, col.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                placeholder={col.label}
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
              />
            </TableCell>
          );
        }

        return null;
      })}
    </TableRow>
  );
}

export function AddOperationalPlanDialog({
  open,
  onOpenChange,
  isAdmin,
  employees,
  strategicGoals,
  initiatives,
  onSubmit,
}: AddOperationalPlanDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<TableRowData[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDef[]>([
    { id: 'action', label: 'إجراء', width: '70px', editable: false, removable: false, isCustom: false },
    { id: 'monthlyAverage', label: 'المتوسط الشهري', width: '10%', editable: true, removable: true, isCustom: false },
    { id: 'annualTarget', label: 'المستهدف السنوي', width: '10%', editable: true, removable: true, isCustom: false },
    { id: 'activity', label: 'النشاط', width: '20%', editable: true, removable: true, isCustom: false },
    { id: 'initiative', label: 'المبادرة', width: '20%', editable: true, removable: true, isCustom: false },
    { id: 'strategicGoal', label: 'الهدف الاستراتيجي', width: '20%', editable: true, removable: true, isCustom: false },
    { id: 'rowNumber', label: '#', width: '40px', editable: false, removable: false, isCustom: false },
  ]);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // "rowId:colId"
  const [mergedCells, setMergedCells] = useState<MergedCell[]>([]);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // إعداد مستشعرات السحب
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // تحديث عنوان العمود
  const updateColumnLabel = useCallback((columnId: string, newLabel: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, label: newLabel } : col
    ));
  }, []);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // إضافة عمود جديد
  const addColumn = useCallback(() => {
    const newColumnId = `custom_${generateId()}`;
    const newColumn: ColumnDef = {
      id: newColumnId,
      label: 'عمود جديد',
      width: '15%',
      editable: true,
      removable: true,
      isCustom: true,
    };
    setColumns(prev => {
      const strategicGoalIndex = prev.findIndex(c => c.id === 'strategicGoal');
      const newColumns = [...prev];
      newColumns.splice(strategicGoalIndex, 0, newColumn);
      return newColumns;
    });
    setRows(prev => prev.map(row => ({
      ...row,
      customColumns: { ...row.customColumns, [newColumnId]: '' }
    })));
  }, []);

  // حذف عمود
  const removeColumn = useCallback((columnId: string) => {
    setColumns(prev => prev.filter(col => col.id !== columnId));
    setRows(prev => prev.map(row => {
      const newCustomColumns = { ...row.customColumns };
      delete newCustomColumns[columnId];
      return { ...row, customColumns: newCustomColumns };
    }));
  }, []);

  // تحديث قيمة عمود مخصص
  const updateCustomColumn = useCallback((rowId: string, columnId: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, customColumns: { ...row.customColumns, [columnId]: value } }
        : row
    ));
  }, []);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId("");
      setYear(new Date().getFullYear());
      setRows([]);
      setSelectedRows(new Set());
    }
  }, [open]);

  // إضافة صف جديد
  const addRow = useCallback(() => {
    const customColumnsInit: Record<string, string> = {};
    columns.filter(c => c.isCustom).forEach(c => {
      customColumnsInit[c.id] = '';
    });

    const newRow: TableRowData = {
      id: generateId(),
      strategicGoal: "",
      initiative: "",
      activity: "",
      annualTarget: 0,
      monthlyAverage: 0,
      goalRowSpan: 1,
      initiativeRowSpan: 1,
      isGoalMerged: false,
      isInitiativeMerged: false,
      showGoalCell: true,
      showInitiativeCell: true,
      customColumns: customColumnsInit,
    };
    setRows(prev => [...prev, newRow]);
  }, [columns]);

  // حذف صف
  const removeRow = useCallback((rowId: string) => {
    setRows(prev => {
      const rowToRemove = prev.find(r => r.id === rowId);
      if (!rowToRemove) return prev;
      return recalculateMerges(prev.filter(r => r.id !== rowId));
    });
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(rowId);
      return newSet;
    });
  }, []);

  // تحديث خلية
  const updateCell = useCallback((rowId: string, field: keyof TableRowData, value: string | number) => {
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: value };
        if (field === 'annualTarget') {
          updatedRow.monthlyAverage = Math.round((value as number) / 12 * 100) / 100;
        }
        return updatedRow;
      }
      return row;
    }));
  }, []);

  // تبديل تحديد صف
  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  }, []);

  // تبديل تحديد خلية
  const toggleCellSelection = useCallback((rowId: string, colId: string) => {
    const cellKey = `${rowId}:${colId}`;
    setSelectedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellKey)) {
        newSet.delete(cellKey);
      } else {
        newSet.add(cellKey);
      }
      return newSet;
    });
  }, []);

  // دمج الخلايا المحددة
  const mergeSelectedCells = useCallback(() => {
    if (selectedCells.size < 2) return;

    const cells = Array.from(selectedCells).map(key => {
      const [rowId, colId] = key.split(':');
      const rowIndex = rows.findIndex(r => r.id === rowId);
      const colIndex = columns.findIndex(c => c.id === colId);
      return { rowId, colId, rowIndex, colIndex };
    }).filter(c => c.rowIndex !== -1 && c.colIndex !== -1);

    if (cells.length < 2) return;

    const minRow = Math.min(...cells.map(c => c.rowIndex));
    const maxRow = Math.max(...cells.map(c => c.rowIndex));
    const minCol = Math.min(...cells.map(c => c.colIndex));
    const maxCol = Math.max(...cells.map(c => c.colIndex));

    // التحقق من أن الخلايا تشكل مستطيلاً
    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    if (cells.length !== expectedCount) {
      return; // الخلايا ليست مستطيلة
    }

    // الحصول على قيمة الخلية الأولى
    const firstCell = cells[0];
    const firstRow = rows[firstCell.rowIndex];
    const firstColId = columns[firstCell.colIndex].id;
    let value = '';
    
    if (firstColId === 'strategicGoal') value = firstRow.strategicGoal;
    else if (firstColId === 'initiative') value = firstRow.initiative;
    else if (firstColId === 'activity') value = firstRow.activity;
    else if (firstColId === 'annualTarget') value = firstRow.annualTarget.toString();
    else if (firstRow.customColumns[firstColId]) value = firstRow.customColumns[firstColId];

    const newMerge: MergedCell = {
      startRow: minRow,
      endRow: maxRow,
      startCol: minCol,
      endCol: maxCol,
      value,
    };

    setMergedCells(prev => [...prev, newMerge]);
    setSelectedCells(new Set());
  }, [selectedCells, rows, columns]);

  // إلغاء دمج الخلايا
  const unmergeSelectedCells = useCallback(() => {
    if (selectedCells.size === 0) return;

    const cells = Array.from(selectedCells).map(key => {
      const [rowId, colId] = key.split(':');
      const rowIndex = rows.findIndex(r => r.id === rowId);
      const colIndex = columns.findIndex(c => c.id === colId);
      return { rowIndex, colIndex };
    });

    setMergedCells(prev => prev.filter(merge => {
      return !cells.some(cell => 
        cell.rowIndex >= merge.startRow && 
        cell.rowIndex <= merge.endRow &&
        cell.colIndex >= merge.startCol && 
        cell.colIndex <= merge.endCol
      );
    }));
    setSelectedCells(new Set());
  }, [selectedCells, rows, columns]);

  // التحقق مما إذا كانت الخلية مدموجة
  const getMergeInfo = useCallback((rowIndex: number, colIndex: number) => {
    for (const merge of mergedCells) {
      if (rowIndex >= merge.startRow && rowIndex <= merge.endRow &&
          colIndex >= merge.startCol && colIndex <= merge.endCol) {
        const isFirst = rowIndex === merge.startRow && colIndex === merge.startCol;
        return {
          isMerged: true,
          isFirst,
          rowSpan: merge.endRow - merge.startRow + 1,
          colSpan: merge.endCol - merge.startCol + 1,
          value: merge.value,
        };
      }
    }
    return { isMerged: false, isFirst: false, rowSpan: 1, colSpan: 1, value: '' };
  }, [mergedCells]);

  // إعادة حساب الدمج
  const recalculateMerges = (currentRows: TableRowData[]): TableRowData[] => {
    if (currentRows.length === 0) return currentRows;

    const result = [...currentRows];
    
    result.forEach(row => {
      row.goalRowSpan = 1;
      row.initiativeRowSpan = 1;
      row.showGoalCell = true;
      row.showInitiativeCell = true;
    });

    let i = 0;
    while (i < result.length) {
      if (result[i].isGoalMerged && result[i].strategicGoal) {
        let span = 1;
        let j = i + 1;
        while (j < result.length && result[j].isGoalMerged && result[j].strategicGoal === result[i].strategicGoal) {
          result[j].showGoalCell = false;
          span++;
          j++;
        }
        result[i].goalRowSpan = span;
        i = j;
      } else {
        i++;
      }
    }

    i = 0;
    while (i < result.length) {
      if (result[i].isInitiativeMerged && result[i].initiative) {
        let span = 1;
        let j = i + 1;
        while (j < result.length && 
               result[j].isInitiativeMerged && 
               result[j].initiative === result[i].initiative &&
               result[j].strategicGoal === result[i].strategicGoal) {
          result[j].showInitiativeCell = false;
          span++;
          j++;
        }
        result[i].initiativeRowSpan = span;
        i = j;
      } else {
        i++;
      }
    }

    return result;
  };

  // دمج الصفوف المحددة (عمود الهدف)
  const mergeGoalCells = useCallback(() => {
    if (selectedRows.size < 2) return;

    const selectedIndices = Array.from(selectedRows)
      .map(id => rows.findIndex(r => r.id === id))
      .filter(i => i !== -1)
      .sort((a, b) => a - b);

    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        return;
      }
    }

    const firstRowGoal = rows[selectedIndices[0]].strategicGoal;
    if (!firstRowGoal) return;

    setRows(prev => {
      const updated = prev.map((row, idx) => {
        if (selectedIndices.includes(idx)) {
          return {
            ...row,
            strategicGoal: firstRowGoal,
            isGoalMerged: true,
          };
        }
        return row;
      });
      return recalculateMerges(updated);
    });
    setSelectedRows(new Set());
  }, [selectedRows, rows]);

  // دمج المبادرات
  const mergeInitiativeCells = useCallback(() => {
    if (selectedRows.size < 2) return;

    const selectedIndices = Array.from(selectedRows)
      .map(id => rows.findIndex(r => r.id === id))
      .filter(i => i !== -1)
      .sort((a, b) => a - b);

    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) return;
      if (rows[selectedIndices[i]].strategicGoal !== rows[selectedIndices[0]].strategicGoal) return;
    }

    const firstRowInitiative = rows[selectedIndices[0]].initiative;
    if (!firstRowInitiative) return;

    setRows(prev => {
      const updated = prev.map((row, idx) => {
        if (selectedIndices.includes(idx)) {
          return {
            ...row,
            initiative: firstRowInitiative,
            isInitiativeMerged: true,
          };
        }
        return row;
      });
      return recalculateMerges(updated);
    });
    setSelectedRows(new Set());
  }, [selectedRows, rows]);

  // إلغاء دمج الهدف
  const unmergeGoalCells = useCallback(() => {
    if (selectedRows.size === 0) return;

    setRows(prev => {
      const updated = prev.map(row => {
        if (selectedRows.has(row.id)) {
          return { ...row, isGoalMerged: false };
        }
        return row;
      });
      return recalculateMerges(updated);
    });
    setSelectedRows(new Set());
  }, [selectedRows]);

  // إلغاء دمج المبادرة
  const unmergeInitiativeCells = useCallback(() => {
    if (selectedRows.size === 0) return;

    setRows(prev => {
      const updated = prev.map(row => {
        if (selectedRows.has(row.id)) {
          return { ...row, isInitiativeMerged: false };
        }
        return row;
      });
      return recalculateMerges(updated);
    });
    setSelectedRows(new Set());
  }, [selectedRows]);

  // معالجة انتهاء سحب العمود
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);

    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // معالجة انتهاء سحب الصف
  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveRowId(null);

    if (over && active.id !== over.id) {
      setRows((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return recalculateMerges(newItems);
      });
    }
  };

  // تحويل الصفوف إلى الهيكل المطلوب للتصدير
  const convertRowsToGoals = (): LocalGoal[] => {
    const goalsMap = new Map<string, LocalGoal>();

    rows.forEach(row => {
      if (!row.strategicGoal || !row.initiative || !row.activity) return;

      const goalKey = row.strategicGoal;
      
      if (!goalsMap.has(goalKey)) {
        const existingGoal = strategicGoals.find(g => g.name === row.strategicGoal);
        goalsMap.set(goalKey, {
          id: generateId(),
          name: row.strategicGoal,
          isNew: !existingGoal,
          existingId: existingGoal?.id,
          initiatives: [],
        });
      }

      const goal = goalsMap.get(goalKey)!;
      
      let initiative = goal.initiatives.find(i => i.name === row.initiative);
      if (!initiative) {
        const existingInitiative = initiatives.find(i => 
          i.name === row.initiative && 
          (goal.existingId ? i.strategic_goal_id === goal.existingId : true)
        );
        initiative = {
          id: generateId(),
          name: row.initiative,
          isNew: !existingInitiative,
          existingId: existingInitiative?.id,
          activities: [],
        };
        goal.initiatives.push(initiative);
      }

      initiative.activities.push({
        id: generateId(),
        name: row.activity,
        annualTarget: row.annualTarget,
      });
    });

    return Array.from(goalsMap.values());
  };

  // التحقق من صحة البيانات
  const canSubmit = () => {
    if (isAdmin && !selectedEmployeeId) return false;
    if (rows.length === 0) return false;
    
    return rows.some(row => 
      row.strategicGoal.trim() && 
      row.initiative.trim() && 
      row.activity.trim() && 
      row.annualTarget > 0
    );
  };

  const handleSubmit = () => {
    const goals = convertRowsToGoals();
    onSubmit({
      selectedEmployeeId,
      goals,
      year,
    });
  };

  // إضافة عدة صفوف دفعة واحدة
  const addMultipleRows = (count: number) => {
    const customColumnsInit: Record<string, string> = {};
    columns.filter(c => c.isCustom).forEach(c => {
      customColumnsInit[c.id] = '';
    });

    const newRows: TableRowData[] = Array.from({ length: count }, () => ({
      id: generateId(),
      strategicGoal: "",
      initiative: "",
      activity: "",
      annualTarget: 0,
      monthlyAverage: 0,
      goalRowSpan: 1,
      initiativeRowSpan: 1,
      isGoalMerged: false,
      isInitiativeMerged: false,
      showGoalCell: true,
      showInitiativeCell: true,
      customColumns: { ...customColumnsInit },
    }));
    setRows(prev => [...prev, ...newRows]);
  };

  const columnIds = columns.map(c => c.id);
  const rowIds = rows.map(r => r.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0" dir="rtl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-4 border-b">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-lg">إضافة خطط تشغيلية</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اسحب الأعمدة والصفوف لإعادة ترتيبها - انقر مزدوج على العناوين لتعديلها
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">السنة:</Label>
                    <Input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Employee Selection for Admin */}
          {isAdmin && (
            <div className="px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm font-medium">الموظف:</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-56 h-8 text-sm">
                    <SelectValue placeholder="اختر الموظف المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.user_id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={addRow}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" />
              صف جديد
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addMultipleRows(5)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" />
              5 صفوف
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addMultipleRows(10)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="w-3 h-3" />
              10 صفوف
            </Button>
            
            <div className="h-4 w-px bg-border mx-2" />

            <Button
              variant="outline"
              size="sm"
              onClick={addColumn}
              className="h-7 text-xs gap-1"
            >
              <Columns className="w-3 h-3" />
              عمود جديد
            </Button>
            
            <div className="h-4 w-px bg-border mx-2" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={mergeGoalCells}
              disabled={selectedRows.size < 2}
              className="h-7 text-xs gap-1"
            >
              <Merge className="w-3 h-3" />
              دمج الأهداف
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={mergeInitiativeCells}
              disabled={selectedRows.size < 2}
              className="h-7 text-xs gap-1"
            >
              <Merge className="w-3 h-3" />
              دمج المبادرات
            </Button>
            
            <div className="h-4 w-px bg-border mx-2" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={unmergeGoalCells}
              disabled={selectedRows.size === 0}
              className="h-7 text-xs gap-1"
            >
              <SplitSquareHorizontal className="w-3 h-3" />
              إلغاء دمج الأهداف
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={unmergeInitiativeCells}
              disabled={selectedRows.size === 0}
              className="h-7 text-xs gap-1"
            >
              <SplitSquareHorizontal className="w-3 h-3" />
              إلغاء دمج المبادرات
            </Button>

            <div className="h-4 w-px bg-border mx-2" />

            <Button
              variant="default"
              size="sm"
              onClick={mergeSelectedCells}
              disabled={selectedCells.size < 2}
              className="h-7 text-xs gap-1"
            >
              <Merge className="w-3 h-3" />
              دمج الخلايا المحددة
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={unmergeSelectedCells}
              disabled={selectedCells.size === 0}
              className="h-7 text-xs gap-1"
            >
              <SplitSquareHorizontal className="w-3 h-3" />
              إلغاء دمج الخلايا
            </Button>

            {selectedRows.size > 0 && (
              <span className="text-xs text-muted-foreground mr-auto">
                {selectedRows.size} صف محدد
              </span>
            )}
            {selectedCells.size > 0 && (
              <span className="text-xs text-primary mr-2">
                {selectedCells.size} خلية محددة
              </span>
            )}
          </div>

          {/* Excel-like Table */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  {/* رأس الجدول مع سحب وإفلات للأعمدة */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(event: DragStartEvent) => setActiveColumnId(event.active.id as string)}
                    onDragEnd={handleColumnDragEnd}
                  >
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                          {columns.map((col) => (
                            <SortableColumnHeader
                              key={col.id}
                              column={col}
                              editingColumn={editingColumn}
                              setEditingColumn={setEditingColumn}
                              updateColumnLabel={updateColumnLabel}
                              removeColumn={removeColumn}
                            />
                          ))}
                        </SortableContext>
                      </TableRow>
                    </TableHeader>
                  </DndContext>

                  {/* جسم الجدول مع سحب وإفلات للصفوف */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(event: DragStartEvent) => setActiveRowId(event.active.id as string)}
                    onDragEnd={handleRowDragEnd}
                  >
                    <TableBody>
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                              <FileSpreadsheet className="w-8 h-8 opacity-50" />
                              <p>لا توجد صفوف - اضغط "صف جديد" للبدء</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                          {rows.map((row, index) => (
                            <SortableRow
                              key={row.id}
                              row={row}
                              index={index}
                              columns={columns}
                              selectedRows={selectedRows}
                              selectedCells={selectedCells}
                              toggleRowSelection={toggleRowSelection}
                              toggleCellSelection={toggleCellSelection}
                              getMergeInfo={getMergeInfo}
                              removeRow={removeRow}
                              updateCell={updateCell}
                              updateCustomColumn={updateCustomColumn}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </TableBody>
                  </DndContext>
                </Table>
              </div>

              {/* Datalists for autocomplete */}
              <datalist id="goals-list">
                {strategicGoals.map(goal => (
                  <option key={goal.id} value={goal.name} />
                ))}
              </datalist>
              <datalist id="initiatives-list">
                {initiatives.map(init => (
                  <option key={init.id} value={init.name} />
                ))}
              </datalist>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {rows.length} صف | {rows.filter(r => r.strategicGoal && r.initiative && r.activity).length} نشاط مكتمل
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!canSubmit()}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                حفظ الخطط
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
