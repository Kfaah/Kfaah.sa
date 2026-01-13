import React, { useState, useEffect, useCallback, forwardRef } from "react";
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
  GripVertical,
  Undo2,
  Grip,
  Palette
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const createDefaultColumns = (): ColumnDef[] => [
  { id: 'action', label: 'إجراء', width: '70px', editable: false, removable: false, isCustom: false },
  { id: 'monthlyAverage', label: 'المتوسط الشهري', width: '10%', editable: true, removable: true, isCustom: false },
  { id: 'annualTarget', label: 'المستهدف السنوي', width: '10%', editable: true, removable: true, isCustom: false },
  { id: 'activity', label: 'النشاط', width: '20%', editable: true, removable: true, isCustom: false },
  { id: 'initiative', label: 'المبادرة', width: '20%', editable: true, removable: true, isCustom: false },
  { id: 'strategicGoal', label: 'الهدف الاستراتيجي', width: '20%', editable: true, removable: true, isCustom: false },
  { id: 'rowNumber', label: '#', width: '40px', editable: false, removable: false, isCustom: false },
];

// هيكل دمج عناوين الأعمدة
interface MergedHeader {
  startCol: number;
  endCol: number;
  label: string;
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
  bgColor?: string; // لون خلفية الصف
}

// ألوان مسبقة للاختيار السريع
const PRESET_COLORS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#fef2f2', '#fef7c3', '#dcfce7', '#dbeafe',
  '#f3e8ff', '#fce7f3', '#fed7aa', '#a5f3fc',
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#f97316', '#06b6d4',
];

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

interface EditingPlan {
  id: string;
  user_id: string;
  activity_name: string;
  strategic_goal: string | null;
  initiative: string | null;
  strategic_goal_id: string | null;
  initiative_id: string | null;
  annual_target: number;
  year: number;
  status: string;
  created_at: string;
  employee_name?: string;
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
  editingPlan?: EditingPlan | null;
}

// مكون العمود القابل للسحب مع إمكانية التحديد وتغيير الحجم
function SortableColumnHeader({ 
  column, 
  editingColumn, 
  setEditingColumn, 
  updateColumnLabel, 
  removeColumn,
  isSelected,
  toggleHeaderSelection,
  mergeInfo,
  onBeforeEdit,
  onResizeStart,
  isResizing,
}: {
  column: ColumnDef;
  editingColumn: string | null;
  setEditingColumn: (id: string | null) => void;
  updateColumnLabel: (id: string, label: string) => void;
  removeColumn: (id: string) => void;
  isSelected: boolean;
  toggleHeaderSelection: (colId: string) => void;
  mergeInfo: { isMerged: boolean; isFirst: boolean; colSpan: number; label: string };
  onBeforeEdit: () => void;
  onResizeStart: (columnId: string, startX: number) => void;
  isResizing: boolean;
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

  // إذا كان العمود مدموجاً وليس الأول، لا نعرضه
  if (mergeInfo.isMerged && !mergeInfo.isFirst) {
    return null;
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      colSpan={mergeInfo.isMerged ? mergeInfo.colSpan : 1}
      className={cn(
        "text-center border-l font-bold relative group",
        column.editable && "cursor-pointer hover:bg-muted",
        isDragging && "bg-primary/20",
        isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
      )}
      onDoubleClick={() => column.editable && setEditingColumn(column.id)}
    >
      <div className="flex items-center justify-center gap-1">
        {/* مقبض التحديد من الأطراف */}
        {column.id !== 'action' && column.id !== 'rowNumber' && (
          <>
            <div
              role="button"
              aria-label="تحديد العمود"
              tabIndex={-1}
              className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-primary/30"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleHeaderSelection(column.id);
              }}
            />
            <div
              role="button"
              aria-label="تحديد العمود"
              tabIndex={-1}
              className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-primary/30"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleHeaderSelection(column.id);
              }}
            />
          </>
        )}

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
            value={mergeInfo.isMerged ? mergeInfo.label : column.label}
            onChange={(e) => updateColumnLabel(column.id, e.target.value)}
            onBlur={() => setEditingColumn(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingColumn(null)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={onBeforeEdit}
            className="h-7 text-center text-sm font-bold border-primary"
            autoFocus
          />
        ) : (
          <>
            <span>{mergeInfo.isMerged ? mergeInfo.label : column.label}</span>
            {column.removable && !mergeInfo.isMerged && (
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
      
      {/* مقبض تغيير عرض العمود */}
      {column.id !== 'action' && column.id !== 'rowNumber' && (
        <div
          className={cn(
            "absolute inset-y-0 start-0 w-1 cursor-col-resize hover:bg-primary z-30 transition-colors",
            isResizing && "bg-primary"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(column.id, e.clientX);
          }}
        />
      )}
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
  onBeforeEdit,
  draggedCell,
  startCellDrag,
  dropCellOnCell,
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
  onBeforeEdit: () => void;
  draggedCell: { rowId: string; colId: string } | null;
  startCellDrag: (rowId: string, colId: string) => void;
  dropCellOnCell: (targetRowId: string, targetColId: string) => void;
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
      style={{
        ...style,
        backgroundColor: row.bgColor || undefined,
      }}
      className={cn(
        "hover:bg-muted/30",
        selectedRows.has(row.id) && "bg-primary/10 hover:bg-primary/15",
        isDragging && "bg-primary/20",
        !row.bgColor && "bg-background"
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
                "border-l text-center text-sm font-medium align-middle relative p-0",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
            >
              {/* تحديد الخلية من الأطراف فقط */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-muted/50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCellSelection(row.id, col.id);
                }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-muted/50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCellSelection(row.id, col.id);
                }}
              />

              <div className="px-2 py-2">
                {mergeInfo.value || ""}
              </div>
            </TableCell>
          );
        }

        // عمود الإجراءات
        if (col.id === 'action') {
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
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRow(row.id);
                  }}
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
                "border-l bg-muted/30 text-sm font-medium relative p-0",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset"
              )}
            >
              {/* تحديد الخلية من الأطراف فقط */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-muted/50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCellSelection(row.id, col.id);
                }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-muted/50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCellSelection(row.id, col.id);
                }}
              />

              <div className="px-2 py-2 text-center">
                {row.monthlyAverage.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
              </div>
            </TableCell>
          );
        }

        // عمود المستهدف السنوي
        if (col.id === 'annualTarget') {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          const isDragSource = draggedCell?.rowId === row.id && draggedCell?.colId === col.id;
          const isDragTarget = draggedCell && (draggedCell.rowId !== row.id || draggedCell.colId !== col.id);
          return (
            <TableCell
              key={col.id}
              className={cn(
                "border-l p-0 relative group/cell",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset",
                isDragSource && "opacity-50 bg-primary/30",
                isDragTarget && "hover:bg-green-100 dark:hover:bg-green-900/30"
              )}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
              {/* مقبض سحب الخلية */}
              <div
                className="absolute top-0 end-0 w-5 h-5 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/cell:opacity-100 transition-opacity bg-muted/80 rounded-bl flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startCellDrag(row.id, col.id);
                }}
              >
                <Grip className="w-3 h-3 text-muted-foreground" />
              </div>
              
              {/* تحديد الخلية من جميع الأطراف */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 top-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />

              <Input
                type="number"
                value={row.annualTarget || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'annualTarget', parseFloat(e.target.value) || 0);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
                placeholder="0"
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-center text-sm"
              />
            </TableCell>
          );
        }

        // عمود النشاط
        if (col.id === 'activity') {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          const isDragSource = draggedCell?.rowId === row.id && draggedCell?.colId === col.id;
          const isDragTarget = draggedCell && (draggedCell.rowId !== row.id || draggedCell.colId !== col.id);
          return (
            <TableCell
              key={col.id}
              className={cn(
                "border-l p-0 relative group/cell",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset",
                isDragSource && "opacity-50 bg-primary/30",
                isDragTarget && "hover:bg-green-100 dark:hover:bg-green-900/30"
              )}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
              {/* مقبض سحب الخلية */}
              <div
                className="absolute top-0 end-0 w-5 h-5 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/cell:opacity-100 transition-opacity bg-muted/80 rounded-bl flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startCellDrag(row.id, col.id);
                }}
              >
                <Grip className="w-3 h-3 text-muted-foreground" />
              </div>
              
              {/* تحديد الخلية من جميع الأطراف */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 top-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />

              <Input
                value={row.activity}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'activity', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
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
          const isDragSource = draggedCell?.rowId === row.id && draggedCell?.colId === col.id;
          const isDragTarget = draggedCell && (draggedCell.rowId !== row.id || draggedCell.colId !== col.id);
          return (
            <TableCell
              key={col.id}
              className={cn(
                "border-l p-0 relative group/cell",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset",
                isDragSource && "opacity-50 bg-primary/30",
                isDragTarget && "hover:bg-green-100 dark:hover:bg-green-900/30"
              )}
              rowSpan={row.initiativeRowSpan}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
              {/* مقبض سحب الخلية */}
              <div
                className="absolute top-0 end-0 w-5 h-5 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/cell:opacity-100 transition-opacity bg-muted/80 rounded-bl flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startCellDrag(row.id, col.id);
                }}
              >
                <Grip className="w-3 h-3 text-muted-foreground" />
              </div>
              
              {/* تحديد الخلية من جميع الأطراف */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 top-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />

              <Input
                value={row.initiative}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'initiative', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
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
          const isDragSource = draggedCell?.rowId === row.id && draggedCell?.colId === col.id;
          const isDragTarget = draggedCell && (draggedCell.rowId !== row.id || draggedCell.colId !== col.id);
          return (
            <TableCell
              key={col.id}
              className={cn(
                "border-l p-0 relative group/cell",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset",
                isDragSource && "opacity-50 bg-primary/30",
                isDragTarget && "hover:bg-green-100 dark:hover:bg-green-900/30"
              )}
              rowSpan={row.goalRowSpan}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
              {/* مقبض سحب الخلية */}
              <div
                className="absolute top-0 end-0 w-5 h-5 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/cell:opacity-100 transition-opacity bg-muted/80 rounded-bl flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startCellDrag(row.id, col.id);
                }}
              >
                <Grip className="w-3 h-3 text-muted-foreground" />
              </div>
              
              {/* تحديد الخلية من جميع الأطراف */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 top-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />

              <Input
                value={row.strategicGoal}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'strategicGoal', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
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
          const isDragSource = draggedCell?.rowId === row.id && draggedCell?.colId === col.id;
          const isDragTarget = draggedCell && (draggedCell.rowId !== row.id || draggedCell.colId !== col.id);
          return (
            <TableCell
              key={col.id}
              className={cn(
                "border-l p-0 relative group/cell",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset",
                isDragSource && "opacity-50 bg-primary/30",
                isDragTarget && "hover:bg-green-100 dark:hover:bg-green-900/30"
              )}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
              {/* مقبض سحب الخلية */}
              <div
                className="absolute top-0 end-0 w-5 h-5 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover/cell:opacity-100 transition-opacity bg-muted/80 rounded-bl flex items-center justify-center"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startCellDrag(row.id, col.id);
                }}
              >
                <Grip className="w-3 h-3 text-muted-foreground" />
              </div>
              
              {/* تحديد الخلية من جميع الأطراف */}
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 top-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />
              <div
                role="button"
                aria-label="تحديد الخلية"
                tabIndex={-1}
                className="absolute inset-x-0 bottom-0 h-2 z-10 cursor-pointer hover:bg-primary/20"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCellSelection(row.id, col.id); }}
              />

              <Input
                value={row.customColumns[col.id] || ""}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCustomColumn(row.id, col.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
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
  editingPlan,
}: AddOperationalPlanDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<TableRowData[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDef[]>(createDefaultColumns);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // "rowId:colId"
  const [mergedCells, setMergedCells] = useState<MergedCell[]>([]);
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set()); // تحديد عناوين الأعمدة
  const [mergedHeaders, setMergedHeaders] = useState<MergedHeader[]>([]); // دمج عناوين الأعمدة
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [draggedCell, setDraggedCell] = useState<{ rowId: string; colId: string } | null>(null);
  
  // حالة تغيير حجم الأعمدة
  const [resizingColumn, setResizingColumn] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);

  // نظام التراجع (Undo) - حتى 10 عمليات
  interface UndoState {
    rows: TableRowData[];
    mergedCells: MergedCell[];
    mergedHeaders: MergedHeader[];
    columns: ColumnDef[];
  }
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const MAX_UNDO = 10;

  // حفظ الحالة الحالية قبل أي عملية
  const saveToUndo = useCallback(() => {
    setUndoStack(prev => {
      const newStack = [...prev, {
        rows: JSON.parse(JSON.stringify(rows)),
        mergedCells: JSON.parse(JSON.stringify(mergedCells)),
        mergedHeaders: JSON.parse(JSON.stringify(mergedHeaders)),
        columns: JSON.parse(JSON.stringify(columns)),
      }];
      // الاحتفاظ بآخر 10 عمليات فقط
      if (newStack.length > MAX_UNDO) {
        return newStack.slice(-MAX_UNDO);
      }
      return newStack;
    });
  }, [rows, mergedCells, mergedHeaders, columns]);

  // التراجع عن آخر عملية
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    const lastState = undoStack[undoStack.length - 1];
    setRows(lastState.rows);
    setMergedCells(lastState.mergedCells);
    setMergedHeaders(lastState.mergedHeaders);
    setColumns(lastState.columns);
    setUndoStack(prev => prev.slice(0, -1));
    setSelectedCells(new Set());
    setSelectedHeaders(new Set());
    setSelectedRows(new Set());
  }, [undoStack]);

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
    saveToUndo();
    setColumns(prev => prev.filter(col => col.id !== columnId));
    setRows(prev => prev.map(row => {
      const newCustomColumns = { ...row.customColumns };
      delete newCustomColumns[columnId];
      return { ...row, customColumns: newCustomColumns };
    }));
  }, [saveToUndo]);

  // تحديث قيمة عمود مخصص
  const updateCustomColumn = useCallback((rowId: string, columnId: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, customColumns: { ...row.customColumns, [columnId]: value } }
        : row
    ));
  }, []);

  // Reset form when dialog closes or load editing plan data
  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId("");
      setYear(new Date().getFullYear());

      // ابدأ من جديد تماماً (لا نحفظ أي عمليات دمج/تحديد/ترتيب بدون حفظ)
      setRows([]);
      setSelectedRows(new Set());
      setSelectedCells(new Set());
      setMergedCells([]);
      setSelectedHeaders(new Set());
      setMergedHeaders([]);
      setColumns(createDefaultColumns());
      setEditingColumn(null);
      setActiveColumnId(null);
      setActiveRowId(null);
      setUndoStack([]);
      setResizingColumn(null);
    } else if (editingPlan) {
      // تحميل بيانات الخطة للتعديل
      const customColumnsInit: Record<string, string> = {};
      columns.filter(c => c.isCustom).forEach(c => {
        customColumnsInit[c.id] = '';
      });

      // البحث عن الموظف المكلف من user_id
      const employee = employees.find(e => e.user_id === editingPlan.user_id);
      if (employee) {
        setSelectedEmployeeId(employee.id);
      }

      setYear(editingPlan.year);
      
      // إنشاء صف للخطة المراد تعديلها
      const editRow: TableRowData = {
        id: editingPlan.id,
        strategicGoal: editingPlan.strategic_goal || "",
        strategicGoalId: editingPlan.strategic_goal_id || undefined,
        initiative: editingPlan.initiative || "",
        initiativeId: editingPlan.initiative_id || undefined,
        activity: editingPlan.activity_name,
        annualTarget: editingPlan.annual_target,
        monthlyAverage: Math.round(editingPlan.annual_target / 12),
        goalRowSpan: 1,
        initiativeRowSpan: 1,
        isGoalMerged: false,
        isInitiativeMerged: false,
        showGoalCell: true,
        showInitiativeCell: true,
        customColumns: customColumnsInit,
      };
      
      setRows([editRow]);
    }
  }, [open, editingPlan, employees]);

  // دالة بدء تغيير حجم العمود
  const handleResizeStart = useCallback((columnId: string, startX: number) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;
    
    // تحويل العرض إلى بكسل
    let startWidth = 100;
    if (column.width.endsWith('px')) {
      startWidth = parseInt(column.width);
    } else if (column.width.endsWith('%')) {
      // تقريب النسبة المئوية إلى بكسل (افتراض عرض الجدول 1000px)
      startWidth = (parseInt(column.width) / 100) * 1000;
    }
    
    saveToUndo();
    setResizingColumn({ columnId, startX, startWidth });
  }, [columns, saveToUndo]);

  // دالة معالجة حركة الماوس أثناء تغيير الحجم
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const diff = resizingColumn.startX - e.clientX; // عكس الاتجاه للـ RTL
    const newWidth = Math.max(50, resizingColumn.startWidth + diff);
    
    setColumns(prev => prev.map(col => 
      col.id === resizingColumn.columnId 
        ? { ...col, width: `${newWidth}px` }
        : col
    ));
  }, [resizingColumn]);

  // دالة إنهاء تغيير الحجم
  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // إضافة وإزالة مستمعي الأحداث لتغيير الحجم
  useEffect(() => {
    if (resizingColumn) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // تغيير لون الصفوف المحددة
  const applyColorToSelectedRows = useCallback((color: string) => {
    if (selectedRows.size === 0) return;
    saveToUndo();
    setRows(prev => prev.map(row => 
      selectedRows.has(row.id) ? { ...row, bgColor: color } : row
    ));
  }, [selectedRows, saveToUndo]);

  // التحقق من وجود تحديد يمكن تلوينه
  const hasSelection = selectedRows.size > 0 || selectedCells.size > 0 || selectedHeaders.size > 0;

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
    saveToUndo();
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
  }, [saveToUndo]);

  // تحديث خلية مع حفظ للتراجع عند فقدان التركيز
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

  // حفظ الحالة قبل بدء التعديل (عند التركيز على الحقل)
  const saveBeforeEdit = useCallback(() => {
    saveToUndo();
  }, [saveToUndo]);

  // بدء سحب خلية
  const startCellDrag = useCallback((rowId: string, colId: string) => {
    setDraggedCell({ rowId, colId });
  }, []);

  // إفلات خلية على خلية أخرى (تبديل المحتوى)
  const dropCellOnCell = useCallback((targetRowId: string, targetColId: string) => {
    if (!draggedCell || (draggedCell.rowId === targetRowId && draggedCell.colId === targetColId)) {
      setDraggedCell(null);
      return;
    }

    saveToUndo();

    setRows(prev => {
      const newRows = [...prev];
      const sourceRow = newRows.find(r => r.id === draggedCell.rowId);
      const targetRow = newRows.find(r => r.id === targetRowId);

      if (!sourceRow || !targetRow) return prev;

      const sourceColId = draggedCell.colId;
      
      // تبديل القيم بناءً على نوع العمود
      const getFieldValue = (row: TableRowData, colId: string): string | number => {
        if (colId === 'annualTarget') return row.annualTarget;
        if (colId === 'activity') return row.activity;
        if (colId === 'initiative') return row.initiative;
        if (colId === 'strategicGoal') return row.strategicGoal;
        if (row.customColumns[colId] !== undefined) return row.customColumns[colId];
        return '';
      };

      const setFieldValue = (row: TableRowData, colId: string, value: string | number) => {
        if (colId === 'annualTarget') row.annualTarget = typeof value === 'number' ? value : parseFloat(value) || 0;
        else if (colId === 'activity') row.activity = String(value);
        else if (colId === 'initiative') row.initiative = String(value);
        else if (colId === 'strategicGoal') row.strategicGoal = String(value);
        else if (row.customColumns[colId] !== undefined || columns.find(c => c.id === colId)?.isCustom) {
          row.customColumns[colId] = String(value);
        }
      };

      const sourceValue = getFieldValue(sourceRow, sourceColId);
      const targetValue = getFieldValue(targetRow, targetColId);

      // تبديل القيم
      setFieldValue(sourceRow, sourceColId, targetValue);
      setFieldValue(targetRow, targetColId, sourceValue);

      return newRows;
    });

    setDraggedCell(null);
  }, [draggedCell, saveToUndo, columns]);

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

  // تبديل تحديد عنوان عمود
  const toggleHeaderSelection = useCallback((colId: string) => {
    setSelectedHeaders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colId)) {
        newSet.delete(colId);
      } else {
        newSet.add(colId);
      }
      return newSet;
    });
  }, []);

  // دمج عناوين الأعمدة المحددة
  const mergeSelectedHeaders = useCallback(() => {
    if (selectedHeaders.size < 2) return;

    const selectedIndices = Array.from(selectedHeaders)
      .map(id => columns.findIndex(c => c.id === id))
      .filter(i => i !== -1)
      .sort((a, b) => a - b);

    if (selectedIndices.length < 2) return;

    // التحقق من أن الأعمدة متجاورة
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        return; // الأعمدة غير متجاورة
      }
    }

    const startCol = selectedIndices[0];
    const endCol = selectedIndices[selectedIndices.length - 1];
    
    // استخدام عنوان العمود الأول كعنوان للعمود المدموج
    const label = columns[startCol].label;

    const newMerge: MergedHeader = {
      startCol,
      endCol,
      label,
    };

    setMergedHeaders(prev => [...prev, newMerge]);
    setSelectedHeaders(new Set());
  }, [selectedHeaders, columns]);

  // إلغاء دمج عناوين الأعمدة المحددة
  const unmergeSelectedHeaders = useCallback(() => {
    if (selectedHeaders.size === 0) return;

    const selectedIndices = Array.from(selectedHeaders)
      .map(id => columns.findIndex(c => c.id === id))
      .filter(i => i !== -1);

    setMergedHeaders(prev => prev.filter(merge => {
      return !selectedIndices.some(idx => 
        idx >= merge.startCol && idx <= merge.endCol
      );
    }));
    setSelectedHeaders(new Set());
  }, [selectedHeaders, columns]);

  // الحصول على معلومات دمج عنوان العمود
  const getHeaderMergeInfo = useCallback((colIndex: number) => {
    for (const merge of mergedHeaders) {
      if (colIndex >= merge.startCol && colIndex <= merge.endCol) {
        const isFirst = colIndex === merge.startCol;
        return {
          isMerged: true,
          isFirst,
          colSpan: merge.endCol - merge.startCol + 1,
          label: merge.label,
        };
      }
    }
    return { isMerged: false, isFirst: false, colSpan: 1, label: '' };
  }, [mergedHeaders]);

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

    saveToUndo();
    setMergedCells(prev => [...prev, newMerge]);
    setSelectedCells(new Set());
  }, [selectedCells, rows, columns, saveToUndo]);

  // إلغاء دمج الخلايا
  const unmergeSelectedCells = useCallback(() => {
    if (selectedCells.size === 0) return;

    const cells = Array.from(selectedCells).map(key => {
      const [rowId, colId] = key.split(':');
      const rowIndex = rows.findIndex(r => r.id === rowId);
      const colIndex = columns.findIndex(c => c.id === colId);
      return { rowIndex, colIndex };
    });

    saveToUndo();
    setMergedCells(prev => prev.filter(merge => {
      return !cells.some(cell => 
        cell.rowIndex >= merge.startRow && 
        cell.rowIndex <= merge.endRow &&
        cell.colIndex >= merge.startCol && 
        cell.colIndex <= merge.endCol
      );
    }));
    setSelectedCells(new Set());
  }, [selectedCells, rows, columns, saveToUndo]);

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


  // معالجة انتهاء سحب العمود
  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);

    if (over && active.id !== over.id) {
      saveToUndo();
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
      saveToUndo();
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
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] overflow-hidden p-0" 
        dir="rtl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-4 border-b">
            <DialogHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-lg">{editingPlan ? 'تعديل خطة تشغيلية' : 'إضافة خطط تشغيلية'}</DialogTitle>
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
              {/* زر الإغلاق */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
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

            <div className="h-4 w-px bg-border mx-2" />

            {/* أداة اختيار الألوان */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasSelection}
                  className="h-7 text-xs gap-1"
                >
                  <Palette className="w-3 h-3" />
                  لون الخلفية
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">اختر لون الخلفية:</p>
                  <div className="grid grid-cols-5 gap-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        onClick={() => applyColorToSelectedRows(color)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Label className="text-xs">مخصص:</Label>
                    <input
                      type="color"
                      className="w-8 h-6 rounded cursor-pointer"
                      onChange={(e) => applyColorToSelectedRows(e.target.value)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="h-4 w-px bg-border mx-2" />

            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={undoStack.length === 0}
              className="h-7 text-xs gap-1"
            >
              <Undo2 className="w-3 h-3" />
              تراجع ({undoStack.length})
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
            {selectedHeaders.size > 0 && (
              <span className="text-xs text-accent-foreground mr-2">
                {selectedHeaders.size} عمود محدد
              </span>
            )}
          </div>

          {/* مؤشر السحب */}
          {draggedCell && (
            <div className="bg-primary/20 text-primary text-xs px-2 py-1 rounded mb-2 flex items-center gap-2">
              <Grip className="w-3 h-3" />
              جاري سحب خلية - أفلتها على خلية أخرى للتبديل
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraggedCell(null)}
                className="h-5 px-2 text-xs"
              >
                إلغاء
              </Button>
            </div>
          )}

          {/* Excel-like Table */}
          <ScrollArea className="flex-1">
            <div 
              className="p-4"
              onMouseUp={() => draggedCell && setDraggedCell(null)}
            >
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
                          {columns.map((col, colIndex) => (
                            <SortableColumnHeader
                              key={col.id}
                              column={col}
                              editingColumn={editingColumn}
                              setEditingColumn={setEditingColumn}
                              updateColumnLabel={updateColumnLabel}
                              removeColumn={removeColumn}
                              isSelected={selectedHeaders.has(col.id)}
                              toggleHeaderSelection={toggleHeaderSelection}
                              mergeInfo={getHeaderMergeInfo(colIndex)}
                              onBeforeEdit={saveBeforeEdit}
                              onResizeStart={handleResizeStart}
                              isResizing={resizingColumn?.columnId === col.id}
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
                              onBeforeEdit={saveBeforeEdit}
                              draggedCell={draggedCell}
                              startCellDrag={startCellDrag}
                              dropCellOnCell={dropCellOnCell}
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
                {editingPlan ? 'حفظ التعديلات' : 'حفظ الخطط'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
