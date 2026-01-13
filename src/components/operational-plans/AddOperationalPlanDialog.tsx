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
  FileSpreadsheet
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
  // خصائص الدمج
  goalRowSpan: number;
  initiativeRowSpan: number;
  isGoalMerged: boolean;
  isInitiativeMerged: boolean;
  showGoalCell: boolean;
  showInitiativeCell: boolean;
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
  const [columns] = useState([
    { id: 'strategicGoal', label: 'الهدف الاستراتيجي', width: '25%' },
    { id: 'initiative', label: 'المبادرة', width: '25%' },
    { id: 'activity', label: 'النشاط', width: '25%' },
    { id: 'annualTarget', label: 'المستهدف السنوي', width: '12.5%' },
    { id: 'monthlyAverage', label: 'المتوسط الشهري', width: '12.5%' },
  ]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedEmployeeId("");
      setYear(new Date().getFullYear());
      setRows([]);
      setSelectedRows(new Set());
    }
  }, [open]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // إضافة صف جديد
  const addRow = useCallback(() => {
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
    };
    setRows(prev => [...prev, newRow]);
  }, []);

  // حذف صف
  const removeRow = useCallback((rowId: string) => {
    setRows(prev => {
      const rowToRemove = prev.find(r => r.id === rowId);
      if (!rowToRemove) return prev;

      // إعادة حساب الدمج بعد الحذف
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

  // إعادة حساب الدمج
  const recalculateMerges = (currentRows: TableRowData[]): TableRowData[] => {
    if (currentRows.length === 0) return currentRows;

    const result = [...currentRows];
    
    // إعادة تعيين جميع خصائص الدمج
    result.forEach(row => {
      row.goalRowSpan = 1;
      row.initiativeRowSpan = 1;
      row.showGoalCell = true;
      row.showInitiativeCell = true;
    });

    // حساب دمج الأهداف
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

    // حساب دمج المبادرات
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

    // تحقق من أن الصفوف متتالية
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        return; // الصفوف غير متتالية
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

    // تحقق من أن الصفوف متتالية ولها نفس الهدف
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
      const initiativeKey = `${goalKey}-${row.initiative}`;
      
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
    }));
    setRows(prev => [...prev, ...newRows]);
  };

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
                    اعمل كأنك في ملف Excel - أضف الصفوف وادمج الخلايا كما تريد
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

            {selectedRows.size > 0 && (
              <span className="text-xs text-muted-foreground mr-auto">
                {selectedRows.size} صف محدد
              </span>
            )}
          </div>

          {/* Excel-like Table */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="w-10 text-center border-l">#</TableHead>
                      {columns.map((col) => (
                        <TableHead 
                          key={col.id} 
                          className="text-center border-l font-bold"
                          style={{ width: col.width }}
                        >
                          {col.label}
                        </TableHead>
                      ))}
                      <TableHead className="w-12 text-center">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <FileSpreadsheet className="w-8 h-8 opacity-50" />
                            <p>لا توجد صفوف - اضغط "صف جديد" للبدء</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row, index) => (
                        <TableRow 
                          key={row.id}
                          className={cn(
                            "hover:bg-muted/30",
                            selectedRows.has(row.id) && "bg-primary/10 hover:bg-primary/15"
                          )}
                        >
                          {/* Row number with selection */}
                          <TableCell 
                            className="text-center border-l cursor-pointer select-none font-medium text-muted-foreground"
                            onClick={() => toggleRowSelection(row.id)}
                          >
                            {index + 1}
                          </TableCell>

                          {/* Strategic Goal */}
                          {row.showGoalCell && (
                            <TableCell 
                              className="border-l p-0"
                              rowSpan={row.goalRowSpan}
                            >
                              <Input
                                value={row.strategicGoal}
                                onChange={(e) => updateCell(row.id, 'strategicGoal', e.target.value)}
                                placeholder="الهدف الاستراتيجي..."
                                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
                                list="goals-list"
                              />
                            </TableCell>
                          )}

                          {/* Initiative */}
                          {row.showInitiativeCell && (
                            <TableCell 
                              className="border-l p-0"
                              rowSpan={row.initiativeRowSpan}
                            >
                              <Input
                                value={row.initiative}
                                onChange={(e) => updateCell(row.id, 'initiative', e.target.value)}
                                placeholder="المبادرة..."
                                className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
                                list="initiatives-list"
                              />
                            </TableCell>
                          )}

                          {/* Activity */}
                          <TableCell className="border-l p-0">
                            <Input
                              value={row.activity}
                              onChange={(e) => updateCell(row.id, 'activity', e.target.value)}
                              placeholder="النشاط..."
                              className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-sm"
                            />
                          </TableCell>

                          {/* Annual Target */}
                          <TableCell className="border-l p-0">
                            <Input
                              type="number"
                              value={row.annualTarget || ""}
                              onChange={(e) => updateCell(row.id, 'annualTarget', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="border-0 h-full w-full rounded-none focus-visible:ring-1 focus-visible:ring-inset text-center text-sm"
                            />
                          </TableCell>

                          {/* Monthly Average (read-only) */}
                          <TableCell className="border-l text-center bg-muted/30 text-sm font-medium">
                            {row.monthlyAverage.toLocaleString('ar-SA', { maximumFractionDigits: 2 })}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-center p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(row.id)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
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
