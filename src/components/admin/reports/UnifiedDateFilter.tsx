import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarRange } from "lucide-react";

export type DatePeriod =
  | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month" | "this_year" | "all" | "custom";

export interface DateRange { from: Date | null; to: Date | null }

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

export function resolvePeriod(p: DatePeriod, custom?: { from?: string; to?: string }): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  const dow = today.getDay(); // 0=Sun ... 6=Sat (Saudi week starts Sunday)
  const startOfThisWeek = addDays(today, -dow);
  const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfThisYear = new Date(today.getFullYear(), 0, 1);
  switch (p) {
    case "today": return { from: today, to: endOfDay(now) };
    case "yesterday": return { from: addDays(today, -1), to: endOfDay(addDays(today, -1)) };
    case "this_week": return { from: startOfThisWeek, to: endOfDay(now) };
    case "last_week": {
      const start = addDays(startOfThisWeek, -7);
      return { from: start, to: endOfDay(addDays(start, 6)) };
    }
    case "this_month": return { from: startOfThisMonth, to: endOfDay(now) };
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
      return { from: start, to: end };
    }
    case "this_year": return { from: startOfThisYear, to: endOfDay(now) };
    case "custom": return {
      from: custom?.from ? startOfDay(new Date(custom.from)) : null,
      to: custom?.to ? endOfDay(new Date(custom.to)) : null,
    };
    default: return { from: null, to: null };
  }
}

const LABELS: Record<DatePeriod, string> = {
  today: "اليوم",
  yesterday: "الأمس",
  this_week: "الأسبوع الحالي",
  last_week: "الأسبوع الماضي",
  this_month: "الشهر الحالي",
  last_month: "الشهر الماضي",
  this_year: "السنة الحالية",
  all: "الكل",
  custom: "نطاق مخصص",
};

interface Props {
  period: DatePeriod;
  onPeriodChange: (p: DatePeriod) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
}

export function UnifiedDateFilter({ period, onPeriodChange, customFrom = "", customTo = "", onCustomChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" dir="rtl">
      <CalendarRange className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">الفلتر الزمني:</span>
      <Select value={period} onValueChange={(v) => onPeriodChange(v as DatePeriod)}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(LABELS) as DatePeriod[]).map((k) => (
            <SelectItem key={k} value={k}>{LABELS[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" && (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            className="w-[150px]"
            value={customFrom}
            onChange={(e) => onCustomChange?.(e.target.value, customTo)}
          />
          <span className="text-xs text-muted-foreground">إلى</span>
          <Input
            type="date"
            className="w-[150px]"
            value={customTo}
            onChange={(e) => onCustomChange?.(customFrom, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}