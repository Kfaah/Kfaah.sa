import React, { useState, useEffect, useCallback, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
  Palette,
  ArrowRight,
  Calendar,
  Loader2,
  Pencil,
  Settings2,
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAvailableYears } from "@/lib/utils";
import { AddColumnDialog, ColumnConfig, ColumnContentType } from "@/components/operational-plans/AddColumnDialog";
import { EditColumnDialog } from "@/components/operational-plans/EditColumnDialog";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  department_id?: string | null;
}

interface Department {
  id: string;
  name: string;
  color?: string;
}

interface StrategicGoal {
  id: string;
  name: string;
  color: string;
  year: number;
  departments?: Department[];
}

interface Initiative {
  id: string;
  strategic_goal_id: string;
  name: string;
  departments?: Department[];
}

interface ColumnDef {
  id: string;
  label: string;
  width: string;
  editable: boolean;
  removable: boolean;
  isCustom: boolean;
  contentType?: ColumnContentType;
  departmentId?: string;
  formulaConfig?: {
    operation: "sum" | "subtract" | "multiply" | "divide" | "average";
    sourceColumns: string[];
  };
  dropdownConfig?: {
    options: string[];
  };
}

// ألوان للتمييز بين الأهداف الاستراتيجية المختلفة
const GOAL_COLORS = [
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
];

const createDefaultColumns = (): ColumnDef[] => [
  { id: 'rowNumber', label: '#', width: '40px', editable: false, removable: false, isCustom: false },
  { id: 'strategicGoal', label: 'الهدف الاستراتيجي', width: '14%', editable: true, removable: true, isCustom: false },
  { id: 'goalOwner', label: 'مالك الهدف', width: '11%', editable: true, removable: true, isCustom: false },
  { id: 'initiative', label: 'المبادرة', width: '14%', editable: true, removable: true, isCustom: false },
  { id: 'initiativeOwner', label: 'مالك المبادرة', width: '11%', editable: true, removable: true, isCustom: false },
  { id: 'activity', label: 'النشاط', width: '14%', editable: true, removable: true, isCustom: false },
  { id: 'responsibleEmployee', label: 'منفذ النشاط', width: '11%', editable: true, removable: true, isCustom: false },
  { id: 'annualTarget', label: 'المستهدف السنوي', width: '7%', editable: true, removable: true, isCustom: false, contentType: 'number' },
  { id: 'monthlyAverage', label: 'المتوسط الشهري', width: '7%', editable: false, removable: true, isCustom: false, contentType: 'number' },
  { id: 'action', label: 'إجراء', width: '60px', editable: false, removable: false, isCustom: false },
];

interface MergedHeader {
  startCol: number;
  endCol: number;
  label: string;
}

interface MergedCell {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  value: string;
}

interface TableRowData {
  id: string;
  strategicGoal: string;
  strategicGoalId?: string;
  goalOwnerDepartmentIds: string[];
  initiative: string;
  initiativeId?: string;
  initiativeOwnerDepartmentIds: string[];
  activity: string;
  responsibleEmployeeId?: string;
  responsibleEmployeeName?: string;
  annualTarget: number;
  monthlyAverage: number;
  goalRowSpan: number;
  initiativeRowSpan: number;
  isGoalMerged: boolean;
  isInitiativeMerged: boolean;
  showGoalCell: boolean;
  showInitiativeCell: boolean;
  customColumns: Record<string, string>;
  bgColor?: string;
}

const PRESET_COLORS = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#fef2f2', '#fef7c3', '#dcfce7', '#dbeafe',
  '#f3e8ff', '#fce7f3', '#fed7aa', '#a5f3fc',
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#f97316', '#06b6d4',
];

interface LocalActivity {
  id: string;
  name: string;
  annualTarget: number;
  responsibleEmployeeId?: string;
}

interface LocalInitiative {
  id: string;
  name: string;
  isNew: boolean;
  existingId?: string;
  departmentIds: string[];
  activities: LocalActivity[];
}

interface LocalGoal {
  id: string;
  name: string;
  isNew: boolean;
  existingId?: string;
  departmentIds: string[];
  initiatives: LocalInitiative[];
}

// مكون العمود القابل للسحب
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
  onEditColumn,
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
  onEditColumn: (column: ColumnDef) => void;
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

  if (mergeInfo.isMerged && !mergeInfo.isFirst) {
    return null;
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      colSpan={mergeInfo.isMerged ? mergeInfo.colSpan : 1}
      className={cn(
        "text-center border-l border-white/20 font-bold relative group text-white py-3",
        column.editable && "cursor-pointer hover:bg-white/10",
        isDragging && "bg-white/20",
        isSelected && "bg-accent ring-2 ring-accent ring-inset text-accent-foreground"
      )}
      onDoubleClick={() => column.editable && onEditColumn(column)}
    >
      <div className="flex items-center justify-center gap-1">
        {column.id !== 'action' && column.id !== 'rowNumber' && (
          <>
            <div
              role="button"
              aria-label="تحديد العمود"
              tabIndex={-1}
              className="absolute inset-y-0 start-0 w-2 z-10 cursor-pointer hover:bg-white/20"
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
              className="absolute inset-y-0 end-0 w-2 z-10 cursor-pointer hover:bg-white/20"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleHeaderSelection(column.id);
              }}
            />
          </>
        )}

        {column.id !== 'action' && column.id !== 'rowNumber' && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-3 h-3 text-white/70" />
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
            className="h-7 text-center text-sm font-bold border-white bg-white text-foreground"
            autoFocus
          />
        ) : (
          <>
            <span>{mergeInfo.isMerged ? mergeInfo.label : column.label}</span>
            {/* زر تعديل العمود */}
            {column.editable && !mergeInfo.isMerged && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditColumn(column);
                }}
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-white/70 hover:text-white hover:bg-white/20"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            {/* زر حذف العمود */}
            {column.removable && !mergeInfo.isMerged && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  removeColumn(column.id);
                }}
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-200 hover:bg-red-500/20"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </>
        )}
      </div>
      
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
  employees,
  departments,
  updateResponsibleEmployee,
  updateGoalDepartments,
  updateInitiativeDepartments,
  goalColorIndex,
  isFirstOfGoal,
  isFirstOfInitiative,
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
  employees: Employee[];
  departments: Department[];
  updateResponsibleEmployee: (rowId: string, employeeId: string, employeeName: string) => void;
  updateGoalDepartments: (rowId: string, deptIds: string[]) => void;
  updateInitiativeDepartments: (rowId: string, deptIds: string[]) => void;
  goalColorIndex: number;
  isFirstOfGoal: boolean;
  isFirstOfInitiative: boolean;
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

  // ألوان متناوبة بناءً على الهدف الاستراتيجي
  const colorScheme = GOAL_COLORS[goalColorIndex % GOAL_COLORS.length];
  const isEvenRow = index % 2 === 0;
  
  return (
    <TableRow
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: row.bgColor || undefined,
      }}
      className={cn(
        "transition-colors duration-150",
        // الألوان حسب الهدف الاستراتيجي
        !row.bgColor && row.strategicGoal && colorScheme.bg,
        !row.bgColor && row.strategicGoal && (isEvenRow ? "opacity-100" : "opacity-90"),
        // خط فاصل عند بداية هدف جديد
        isFirstOfGoal && "border-t-2 border-t-primary/30",
        // خط فاصل أخف عند بداية مبادرة جديدة
        !isFirstOfGoal && isFirstOfInitiative && "border-t border-t-primary/15",
        "hover:brightness-95",
        selectedRows.has(row.id) && "!bg-accent/30 hover:!bg-accent/35",
        isDragging && "!bg-primary/20 shadow-lg"
      )}
    >
      {columns.map((col, colIndex) => {
        const mergeInfo = getMergeInfo(index, colIndex);

        if (mergeInfo.isMerged) {
          if (!mergeInfo.isFirst) return null;

          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          return (
            <TableCell
              key={`${col.id}-merged-${index}`}
              rowSpan={mergeInfo.rowSpan}
              colSpan={mergeInfo.colSpan}
              className={cn(
                "border-l border-primary/10 text-center text-sm font-medium align-middle relative p-0 bg-gradient-to-b from-accent/10 to-transparent",
                isSelected && "bg-accent/25 ring-2 ring-accent ring-inset"
              )}
            >
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

        // عمود رقم الصف
        if (col.id === 'rowNumber') {
          return (
            <TableCell
              key={col.id}
              className="text-center border-l border-primary/10 text-sm text-primary font-bold w-10 relative bg-primary/5"
            >
              <div
                role="button"
                aria-label="تحديد الصف"
                tabIndex={-1}
                className="absolute inset-0 z-10 cursor-pointer hover:bg-muted/50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleRowSelection(row.id);
                }}
              />
              {index + 1}
            </TableCell>
          );
        }

        // عمود الإجراءات
        if (col.id === 'action') {
          return (
            <TableCell key={col.id} className="text-center p-1 border-l border-primary/10 bg-muted/20">
              <div className="flex items-center justify-center gap-1">
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
                "border-l border-primary/10 bg-accent/10 text-sm font-medium relative p-0",
                isSelected && "bg-accent/30 ring-2 ring-accent ring-inset"
              )}
            >
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
                "border-l border-primary/10 p-0 relative group/cell",
                isSelected && "bg-accent/20 ring-2 ring-accent ring-inset",
                isDragSource && "opacity-50 bg-accent/30",
                isDragTarget && "hover:bg-accent/20"
              )}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
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
                "border-l border-primary/10 p-0 relative group/cell",
                isSelected && "bg-accent/20 ring-2 ring-accent ring-inset",
                isDragSource && "opacity-50 bg-accent/30",
                isDragTarget && "hover:bg-accent/20"
              )}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
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

        // عمود الموظف المنفذ
        if (col.id === 'responsibleEmployee') {
          return (
            <TableCell key={col.id} className="border-l border-primary/10 p-1 bg-primary/5">
              <Select
                value={row.responsibleEmployeeId || ""}
                onValueChange={(value) => {
                  const emp = employees.find(e => e.id === value);
                  if (emp) {
                    updateResponsibleEmployee(row.id, emp.id, emp.full_name);
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/50">
                  <SelectValue placeholder="اختر المنفذ..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          );
        }

        // عمود مالك المبادرة
        if (col.id === 'initiativeOwner') {
          if (!row.showInitiativeCell) return null;
          return (
            <TableCell key={col.id} className="border-l border-primary/10 p-1 bg-accent/5" rowSpan={row.initiativeRowSpan}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-full text-xs justify-start gap-1 hover:bg-muted/50">
                    {row.initiativeOwnerDepartmentIds.length > 0 ? (
                      <span className="truncate">{row.initiativeOwnerDepartmentIds.length} قسم</span>
                    ) : (
                      <span className="text-muted-foreground">اختر...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {departments.map((dept) => (
                      <label key={dept.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={row.initiativeOwnerDepartmentIds.includes(dept.id)}
                          onChange={() => {
                            const newIds = row.initiativeOwnerDepartmentIds.includes(dept.id)
                              ? row.initiativeOwnerDepartmentIds.filter(id => id !== dept.id)
                              : [...row.initiativeOwnerDepartmentIds, dept.id];
                            updateInitiativeDepartments(row.id, newIds);
                          }}
                          className="rounded"
                        />
                        {dept.name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </TableCell>
          );
        }

        // عمود مالك الهدف
        if (col.id === 'goalOwner') {
          if (!row.showGoalCell) return null;
          return (
            <TableCell key={col.id} className="border-l border-primary/10 p-1 bg-primary/5" rowSpan={row.goalRowSpan}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-full text-xs justify-start gap-1 hover:bg-muted/50">
                    {row.goalOwnerDepartmentIds.length > 0 ? (
                      <span className="truncate">{row.goalOwnerDepartmentIds.length} قسم</span>
                    ) : (
                      <span className="text-muted-foreground">اختر...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {departments.map((dept) => (
                      <label key={dept.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={row.goalOwnerDepartmentIds.includes(dept.id)}
                          onChange={() => {
                            const newIds = row.goalOwnerDepartmentIds.includes(dept.id)
                              ? row.goalOwnerDepartmentIds.filter(id => id !== dept.id)
                              : [...row.goalOwnerDepartmentIds, dept.id];
                            updateGoalDepartments(row.id, newIds);
                          }}
                          className="rounded"
                        />
                        {dept.name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
                "border-l border-primary/10 p-0 relative group/cell bg-accent/5",
                isSelected && "bg-accent/20 ring-2 ring-accent ring-inset",
                isDragSource && "opacity-50 bg-accent/30",
                isDragTarget && "hover:bg-accent/20"
              )}
              rowSpan={row.initiativeRowSpan}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
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

              <Input
                value={row.initiative}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'initiative', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
                placeholder="المبادرة..."
                list="initiatives-list"
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
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
                "border-l border-primary/10 p-0 relative group/cell bg-primary/5",
                isSelected && "bg-primary/20 ring-2 ring-primary ring-inset",
                isDragSource && "opacity-50 bg-primary/30",
                isDragTarget && "hover:bg-primary/15"
              )}
              rowSpan={row.goalRowSpan}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
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

              <Input
                value={row.strategicGoal}
                onChange={(e) => {
                  e.stopPropagation();
                  updateCell(row.id, 'strategicGoal', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
                placeholder="الهدف الاستراتيجي..."
                list="goals-list"
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
              />
            </TableCell>
          );
        }

        // الأعمدة المخصصة
        if (col.isCustom) {
          const isSelected = selectedCells.has(`${row.id}:${col.id}`);
          const isDragSource = draggedCell?.rowId === row.id && draggedCell?.colId === col.id;
          const isDragTarget = draggedCell && (draggedCell.rowId !== row.id || draggedCell.colId !== col.id);
          const cellValue = row.customColumns[col.id] || "";
          const contentType = col.contentType || "text";

          // قائمة الموظفين المناسبة (الكل أو من قسم محدد)
          const eligibleEmployees = contentType === "employee_department" && col.departmentId
            ? employees.filter(e => e.department_id === col.departmentId)
            : employees;

          // اختيار الكنترول المناسب حسب نوع المحتوى
          let innerControl: React.ReactNode;

          if (contentType === "employee" || contentType === "employee_department") {
            const selectedEmp = eligibleEmployees.find(e => e.id === cellValue);
            innerControl = (
              <div className="relative h-full w-full flex items-center">
                <Select
                  value={cellValue}
                  onValueChange={(v) => updateCustomColumn(row.id, col.id, v)}
                >
                  <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/50 rounded-none pe-7">
                    <SelectValue placeholder="اختر موظف...">
                      {selectedEmp?.full_name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleEmployees.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2">لا يوجد موظفون</div>
                    ) : eligibleEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cellValue && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); updateCustomColumn(row.id, col.id, ""); }}
                    className="absolute start-1 top-1/2 -translate-y-1/2 z-30 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    aria-label="مسح"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          } else if (contentType === "dropdown") {
            const options = col.dropdownConfig?.options || [];
            innerControl = (
              <div className="relative h-full w-full flex items-center">
                <Select
                  value={cellValue}
                  onValueChange={(v) => updateCustomColumn(row.id, col.id, v)}
                >
                  <SelectTrigger className="h-8 text-xs border-0 bg-transparent hover:bg-muted/50 rounded-none pe-7">
                    <SelectValue placeholder={col.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2">لا توجد خيارات</div>
                    ) : options.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cellValue && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); updateCustomColumn(row.id, col.id, ""); }}
                    className="absolute start-1 top-1/2 -translate-y-1/2 z-30 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    aria-label="مسح"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          } else if (contentType === "date") {
            innerControl = (
              <Input
                type="date"
                value={cellValue}
                onChange={(e) => { e.stopPropagation(); updateCustomColumn(row.id, col.id, e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
              />
            );
          } else if (contentType === "number" || contentType === "percentage") {
            innerControl = (
              <Input
                type="number"
                value={cellValue}
                onChange={(e) => { e.stopPropagation(); updateCustomColumn(row.id, col.id, e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
                placeholder={contentType === "percentage" ? "%" : col.label}
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm text-center"
              />
            );
          } else {
            innerControl = (
              <Input
                value={cellValue}
                onChange={(e) => { e.stopPropagation(); updateCustomColumn(row.id, col.id, e.target.value); }}
                onClick={(e) => e.stopPropagation()}
                onFocus={onBeforeEdit}
                placeholder={col.label}
                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
              />
            );
          }

          return (
            <TableCell
              key={col.id}
              className={cn(
                "border-l border-primary/10 p-0 relative group/cell",
                isSelected && "bg-accent/20 ring-2 ring-accent ring-inset",
                isDragSource && "opacity-50 bg-accent/30",
                isDragTarget && "hover:bg-accent/20"
              )}
              onMouseUp={() => isDragTarget && dropCellOnCell(row.id, col.id)}
            >
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

              {innerControl}
            </TableCell>
          );
        }

        return null;
      })}
    </TableRow>
  );
}

const AddOperationalPlan = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [strategicGoals, setStrategicGoals] = useState<StrategicGoal[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<TableRowData[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState<ColumnDef[]>(createDefaultColumns);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [mergedCells, setMergedCells] = useState<MergedCell[]>([]);
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(new Set());
  const [mergedHeaders, setMergedHeaders] = useState<MergedHeader[]>([]);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [draggedCell, setDraggedCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [resizingColumn, setResizingColumn] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  
  // نوافذ الأعمدة
  const [showAddColumnDialog, setShowAddColumnDialog] = useState(false);
  const [showEditColumnDialog, setShowEditColumnDialog] = useState(false);
  const [editingColumnData, setEditingColumnData] = useState<ColumnDef | null>(null);

  // نظام التراجع
  interface UndoState {
    rows: TableRowData[];
    mergedCells: MergedCell[];
    mergedHeaders: MergedHeader[];
    columns: ColumnDef[];
  }
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  const MAX_UNDO = 10;

  const saveToUndo = useCallback(() => {
    setUndoStack(prev => {
      const newStack = [...prev, {
        rows: JSON.parse(JSON.stringify(rows)),
        mergedCells: JSON.parse(JSON.stringify(mergedCells)),
        mergedHeaders: JSON.parse(JSON.stringify(mergedHeaders)),
        columns: JSON.parse(JSON.stringify(columns)),
      }];
      if (newStack.length > MAX_UNDO) {
        return newStack.slice(-MAX_UNDO);
      }
      return newStack;
    });
  }, [rows, mergedCells, mergedHeaders, columns]);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [departmentsRes, employeesRes, goalsRes, initiativesRes] = await Promise.all([
          supabase.from("departments").select("id, name, color").order("name"),
          supabase.from("employees").select("id, user_id, full_name, department_id").eq("status", "active").order("full_name"),
          supabase.from("strategic_goals").select("id, name, color, year").eq("year", year).order("display_order"),
          supabase.from("initiatives").select("id, strategic_goal_id, name").order("display_order"),
        ]);

        if (departmentsRes.error) throw departmentsRes.error;
        if (employeesRes.error) throw employeesRes.error;
        if (goalsRes.error) throw goalsRes.error;
        if (initiativesRes.error) throw initiativesRes.error;

        setDepartments(departmentsRes.data || []);
        setEmployees(employeesRes.data || []);
        setStrategicGoals(goalsRes.data || []);
        setInitiatives(initiativesRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء جلب البيانات",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [year]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const updateColumnLabel = useCallback((columnId: string, newLabel: string) => {
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, label: newLabel } : col
    ));
  }, []);

  const addColumn = useCallback(() => {
    setShowAddColumnDialog(true);
  }, []);

  const handleAddColumn = useCallback((config: ColumnConfig) => {
    saveToUndo();
    const newColumn: ColumnDef = {
      id: config.id,
      label: config.label,
      width: config.width,
      editable: config.editable,
      removable: config.removable,
      isCustom: config.isCustom,
      contentType: config.contentType,
      departmentId: config.departmentId,
      formulaConfig: config.formulaConfig,
      dropdownConfig: config.dropdownConfig,
    };
    setColumns(prev => {
      const actionIndex = prev.findIndex(c => c.id === 'action');
      const newColumns = [...prev];
      newColumns.splice(actionIndex, 0, newColumn);
      return newColumns;
    });
    setRows(prev => prev.map(row => ({
      ...row,
      customColumns: { ...row.customColumns, [config.id]: '' }
    })));
  }, [saveToUndo]);

  const handleEditColumn = useCallback((column: ColumnDef) => {
    setEditingColumnData(column);
    setShowEditColumnDialog(true);
  }, []);

  const handleSaveColumnEdit = useCallback((columnId: string, newLabel: string) => {
    saveToUndo();
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, label: newLabel } : col
    ));
  }, [saveToUndo]);

  const removeColumn = useCallback((columnId: string) => {
    saveToUndo();
    setColumns(prev => prev.filter(col => col.id !== columnId));
    setRows(prev => prev.map(row => {
      const newCustomColumns = { ...row.customColumns };
      delete newCustomColumns[columnId];
      return { ...row, customColumns: newCustomColumns };
    }));
  }, [saveToUndo]);

  const updateCustomColumn = useCallback((rowId: string, columnId: string, value: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, customColumns: { ...row.customColumns, [columnId]: value } }
        : row
    ));
  }, []);

  const handleResizeStart = useCallback((columnId: string, startX: number) => {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;
    
    let startWidth = 100;
    if (column.width.endsWith('px')) {
      startWidth = parseInt(column.width);
    } else if (column.width.endsWith('%')) {
      startWidth = (parseInt(column.width) / 100) * 1000;
    }
    
    saveToUndo();
    setResizingColumn({ columnId, startX, startWidth });
  }, [columns, saveToUndo]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const diff = resizingColumn.startX - e.clientX;
    const newWidth = Math.max(50, resizingColumn.startWidth + diff);
    
    setColumns(prev => prev.map(col => 
      col.id === resizingColumn.columnId 
        ? { ...col, width: `${newWidth}px` }
        : col
    ));
  }, [resizingColumn]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

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

  const applyColorToSelectedRows = useCallback((color: string) => {
    if (selectedRows.size === 0) return;
    saveToUndo();
    setRows(prev => prev.map(row => 
      selectedRows.has(row.id) ? { ...row, bgColor: color } : row
    ));
  }, [selectedRows, saveToUndo]);

  const hasSelection = selectedRows.size > 0 || selectedCells.size > 0 || selectedHeaders.size > 0;

  const addRow = useCallback(() => {
    const customColumnsInit: Record<string, string> = {};
    columns.filter(c => c.isCustom).forEach(c => {
      customColumnsInit[c.id] = '';
    });

    const newRow: TableRowData = {
      id: generateId(),
      strategicGoal: "",
      goalOwnerDepartmentIds: [],
      initiative: "",
      initiativeOwnerDepartmentIds: [],
      activity: "",
      responsibleEmployeeId: undefined,
      responsibleEmployeeName: undefined,
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

  const updateResponsibleEmployee = useCallback((rowId: string, employeeId: string, employeeName: string) => {
    setRows(prev => prev.map(row => 
      row.id === rowId 
        ? { ...row, responsibleEmployeeId: employeeId, responsibleEmployeeName: employeeName }
        : row
    ));
  }, []);

  const updateGoalDepartments = useCallback((rowId: string, deptIds: string[]) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, goalOwnerDepartmentIds: deptIds } : row
    ));
  }, []);

  const updateInitiativeDepartments = useCallback((rowId: string, deptIds: string[]) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, initiativeOwnerDepartmentIds: deptIds } : row
    ));
  }, []);

  const saveBeforeEdit = useCallback(() => {
    saveToUndo();
  }, [saveToUndo]);

  const startCellDrag = useCallback((rowId: string, colId: string) => {
    setDraggedCell({ rowId, colId });
  }, []);

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

      setFieldValue(sourceRow, sourceColId, targetValue);
      setFieldValue(targetRow, targetColId, sourceValue);

      if (sourceColId === 'annualTarget') {
        sourceRow.monthlyAverage = Math.round(sourceRow.annualTarget / 12 * 100) / 100;
      }
      if (targetColId === 'annualTarget') {
        targetRow.monthlyAverage = Math.round(targetRow.annualTarget / 12 * 100) / 100;
      }

      return newRows;
    });

    setDraggedCell(null);
  }, [draggedCell, columns, saveToUndo]);

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

  const toggleCellSelection = useCallback((rowId: string, colId: string) => {
    const key = `${rowId}:${colId}`;
    setSelectedCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

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

  const mergeSelectedHeaders = useCallback(() => {
    if (selectedHeaders.size < 2) return;

    const selectedIndices = Array.from(selectedHeaders)
      .map(id => columns.findIndex(c => c.id === id))
      .filter(i => i !== -1)
      .sort((a, b) => a - b);

    if (selectedIndices.length < 2) return;

    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        return;
      }
    }

    const startCol = selectedIndices[0];
    const endCol = selectedIndices[selectedIndices.length - 1];
    const label = columns[startCol].label;

    const newMerge: MergedHeader = {
      startCol,
      endCol,
      label,
    };

    setMergedHeaders(prev => [...prev, newMerge]);
    setSelectedHeaders(new Set());
  }, [selectedHeaders, columns]);

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

    const expectedCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    if (cells.length !== expectedCount) {
      return;
    }

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
          departmentIds: row.goalOwnerDepartmentIds || [],
          initiatives: [],
        });
      }

      const goal = goalsMap.get(goalKey)!;
      
      if (goal.departmentIds.length === 0 && row.goalOwnerDepartmentIds.length > 0) {
        goal.departmentIds = row.goalOwnerDepartmentIds;
      }
      
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
          departmentIds: row.initiativeOwnerDepartmentIds || [],
          activities: [],
        };
        goal.initiatives.push(initiative);
      }
      
      if (initiative.departmentIds.length === 0 && row.initiativeOwnerDepartmentIds.length > 0) {
        initiative.departmentIds = row.initiativeOwnerDepartmentIds;
      }

      initiative.activities.push({
        id: generateId(),
        name: row.activity,
        annualTarget: row.annualTarget,
        responsibleEmployeeId: row.responsibleEmployeeId,
      });
    });

    return Array.from(goalsMap.values());
  };

  const canSubmit = () => {
    if (rows.length === 0) return false;
    
    return rows.some(row => 
      row.strategicGoal.trim() && 
      row.initiative.trim() && 
      row.activity.trim() && 
      row.annualTarget > 0
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit() || !authUser) return;

    setIsLoading(true);
    try {
      const goals = convertRowsToGoals();

      for (const goal of goals) {
        let goalId = goal.existingId;

        // إنشاء الهدف الاستراتيجي إذا كان جديداً
        if (goal.isNew) {
          const { data: newGoal, error: goalError } = await supabase
            .from("strategic_goals")
            .insert({ name: goal.name, year, color: "hsl(var(--primary))" })
            .select()
            .single();

          if (goalError) throw goalError;
          goalId = newGoal.id;

          // إضافة الأقسام المالكة
          if (goal.departmentIds.length > 0) {
            await supabase
              .from("strategic_goal_departments")
              .insert(goal.departmentIds.map(deptId => ({
                strategic_goal_id: goalId,
                department_id: deptId,
              })));
          }
        }

        for (const init of goal.initiatives) {
          let initId = init.existingId;

          // إنشاء المبادرة إذا كانت جديدة
          if (init.isNew) {
            const { data: newInit, error: initError } = await supabase
              .from("initiatives")
              .insert({ name: init.name, strategic_goal_id: goalId })
              .select()
              .single();

            if (initError) throw initError;
            initId = newInit.id;

            // إضافة الأقسام المالكة
            if (init.departmentIds.length > 0) {
              await supabase
                .from("initiative_departments")
                .insert(init.departmentIds.map(deptId => ({
                  initiative_id: initId,
                  department_id: deptId,
                })));
            }
          }

          // إنشاء الأنشطة
          for (const activity of init.activities) {
            const { data: plan, error: planError } = await supabase
              .from("operational_plans")
              .insert({
                user_id: authUser.id,
                activity_name: activity.name,
                strategic_goal: goal.name,
                strategic_goal_id: goalId,
                initiative: init.name,
                initiative_id: initId,
                annual_target: activity.annualTarget,
                year,
                responsible_employee_id: activity.responsibleEmployeeId || null,
                status: "active",
              })
              .select()
              .single();

            if (planError) throw planError;

            // إنشاء المستهدفات الشهرية
            const monthlyData = Array.from({ length: 12 }, (_, index) => ({
              operational_plan_id: plan.id,
              month: index + 1,
              monthly_target: Math.round(activity.annualTarget / 12),
            }));

            const { error: monthsError } = await supabase
              .from("operational_plan_months")
              .insert(monthlyData);

            if (monthsError) throw monthsError;
          }
        }
      }

      toast({ title: "تم إضافة الخطط التشغيلية بنجاح" });
      navigate("/operational-plans");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إضافة الخطط",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addMultipleRows = (count: number) => {
    const customColumnsInit: Record<string, string> = {};
    columns.filter(c => c.isCustom).forEach(c => {
      customColumnsInit[c.id] = '';
    });

    const newRows: TableRowData[] = Array.from({ length: count }, () => ({
      id: generateId(),
      strategicGoal: "",
      goalOwnerDepartmentIds: [],
      initiative: "",
      initiativeOwnerDepartmentIds: [],
      activity: "",
      responsibleEmployeeId: undefined,
      responsibleEmployeeName: undefined,
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

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/operational-plans")}
                  className="rounded-xl hover:bg-muted"
                >
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">إضافة خطط تشغيلية</h1>
                    <p className="text-sm text-muted-foreground">اسحب الأعمدة والصفوف لإعادة ترتيبها - انقر مزدوج على العناوين لتعديلها</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Select
                    value={year.toString()}
                    onValueChange={(v) => setYear(parseInt(v))}
                  >
                    <SelectTrigger className="h-8 w-24 border-0 bg-transparent text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableYears().map((y) => (
                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigate("/operational-plans")}
                  disabled={isLoading}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !canSubmit()}
                  className="gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ الخطط
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b bg-gradient-to-l from-primary/5 via-accent/5 to-transparent flex items-center gap-2 flex-wrap">
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
          
          <Button
            variant="default"
            size="sm"
            onClick={mergeSelectedHeaders}
            disabled={selectedHeaders.size < 2}
            className="h-7 text-xs gap-1"
          >
            <Merge className="w-3 h-3" />
            دمج العناوين المحددة
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={unmergeSelectedHeaders}
            disabled={selectedHeaders.size === 0}
            className="h-7 text-xs gap-1"
          >
            <SplitSquareHorizontal className="w-3 h-3" />
            إلغاء دمج العناوين
          </Button>

          <div className="h-4 w-px bg-border mx-2" />

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
          <div className="bg-primary/20 text-primary text-xs px-4 py-2 flex items-center gap-2">
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
        <div className="flex-1 overflow-auto">
          <div 
            className="p-6"
            onMouseUp={() => draggedCell && setDraggedCell(null)}
          >
            <div className="border-2 border-primary/20 rounded-xl overflow-hidden shadow-lg bg-card">
              <Table>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(event: DragStartEvent) => setActiveColumnId(event.active.id as string)}
                  onDragEnd={handleColumnDragEnd}
                >
                  <TableHeader>
                    <TableRow className="bg-[hsl(160,50%,25%)] hover:bg-[hsl(160,50%,28%)]">
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
                            onEditColumn={handleEditColumn}
                          />
                        ))}
                      </SortableContext>
                    </TableRow>
                  </TableHeader>
                </DndContext>

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
                        {rows.map((row, index) => {
                          // حساب فهرس لون الهدف
                          const uniqueGoals = [...new Set(rows.slice(0, index + 1).map(r => r.strategicGoal).filter(Boolean))];
                          const goalColorIndex = uniqueGoals.indexOf(row.strategicGoal);
                          
                          // هل هذا أول صف لهدف جديد؟
                          const isFirstOfGoal = index === 0 || rows[index - 1].strategicGoal !== row.strategicGoal;
                          
                          // هل هذا أول صف لمبادرة جديدة؟
                          const isFirstOfInitiative = index === 0 || 
                            rows[index - 1].initiative !== row.initiative || 
                            rows[index - 1].strategicGoal !== row.strategicGoal;
                          
                          return (
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
                              employees={employees}
                              departments={departments}
                              updateResponsibleEmployee={updateResponsibleEmployee}
                              updateGoalDepartments={updateGoalDepartments}
                              updateInitiativeDepartments={updateInitiativeDepartments}
                              goalColorIndex={goalColorIndex >= 0 ? goalColorIndex : 0}
                              isFirstOfGoal={isFirstOfGoal}
                              isFirstOfInitiative={isFirstOfInitiative}
                            />
                          );
                        })}
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
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 border-t-2 border-primary/20 bg-gradient-to-l from-primary/5 via-accent/5 to-background backdrop-blur-sm flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {rows.length} صف | {rows.filter(r => r.strategicGoal && r.initiative && r.activity).length} نشاط مكتمل
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/operational-plans")}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!canSubmit() || isLoading}
              className="gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الخطط
            </Button>
          </div>
        </div>
      </div>

      {/* نوافذ إضافة وتعديل الأعمدة */}
      <AddColumnDialog
        open={showAddColumnDialog}
        onOpenChange={setShowAddColumnDialog}
        onAdd={handleAddColumn}
        departments={departments}
        existingColumns={columns.map(c => ({ id: c.id, label: c.label }))}
      />

      <EditColumnDialog
        open={showEditColumnDialog}
        onOpenChange={setShowEditColumnDialog}
        column={editingColumnData}
        onSave={handleSaveColumnEdit}
        onDelete={removeColumn}
      />
    </DashboardLayout>
  );
};

export default AddOperationalPlan;
