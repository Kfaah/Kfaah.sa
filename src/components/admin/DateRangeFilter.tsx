import { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/hooks/useAdminAggregates";

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay   = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

function buildPreset(key: string): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  const dow = now.getDay(); // 0=Sun
  switch (key) {
    case "today":      return { from: today, to: endOfDay(now), label: "اليوم" };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { from: y, to: endOfDay(y), label: "الأمس" };
    }
    case "this_week": {
      const f = new Date(today); f.setDate(f.getDate() - dow);
      return { from: f, to: endOfDay(now), label: "هذا الأسبوع" };
    }
    case "last_week": {
      const f = new Date(today); f.setDate(f.getDate() - dow - 7);
      const t = new Date(f); t.setDate(t.getDate() + 6);
      return { from: f, to: endOfDay(t), label: "الأسبوع الماضي" };
    }
    case "this_month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now), label: "هذا الشهر" };
    case "last_month": {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { from: f, to: t, label: "الشهر الماضي" };
    }
    case "this_year": return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now), label: "هذه السنة" };
    case "last_year": {
      const f = new Date(now.getFullYear() - 1, 0, 1);
      const t = endOfDay(new Date(now.getFullYear() - 1, 11, 31));
      return { from: f, to: t, label: "السنة الماضية" };
    }
    case "all":
    default:           return { from: null, to: null, label: "منذ البداية" };
  }
}

const PRESETS = [
  ["all", "منذ البداية"],
  ["today", "اليوم"],
  ["yesterday", "الأمس"],
  ["this_week", "هذا الأسبوع"],
  ["last_week", "الأسبوع الماضي"],
  ["this_month", "هذا الشهر"],
  ["last_month", "الشهر الماضي"],
  ["last_year", "السنة الماضية"],
] as const;

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [openCustom, setOpenCustom] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(value.from || undefined);
  const [tempTo, setTempTo] = useState<Date | undefined>(value.to || undefined);
  const [activeKey, setActiveKey] = useState<string>("all");

  const apply = (key: string) => {
    setActiveKey(key);
    onChange(buildPreset(key));
  };

  const applyCustom = () => {
    if (tempFrom && tempTo) {
      setActiveKey("custom");
      onChange({
        from: startOfDay(tempFrom),
        to: endOfDay(tempTo),
        label: `من ${tempFrom.toLocaleDateString("ar-SA")} إلى ${tempTo.toLocaleDateString("ar-SA")}`,
      });
      setOpenCustom(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs px-2">
        <CalendarIcon className="w-4 h-4" />
        <span className="font-semibold">الفترة:</span>
      </div>
      {PRESETS.map(([k, label]) => (
        <button
          key={k}
          onClick={() => apply(k)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-semibold border transition-all",
            activeKey === k
              ? "bg-accent text-accent-foreground border-accent shadow-sm"
              : "bg-background border-border text-foreground hover:border-accent/60 hover:bg-accent/10"
          )}
        >
          {label}
        </button>
      ))}

      <Popover open={openCustom} onOpenChange={setOpenCustom}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-auto py-1.5 px-3 text-xs font-semibold gap-1",
              activeKey === "custom" && "bg-accent text-accent-foreground border-accent"
            )}
          >
            فترة مخصصة
            <ChevronDown className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-popover" align="end">
          <div className="flex gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">من</div>
              <Calendar mode="single" selected={tempFrom} onSelect={setTempFrom} className={cn("p-0 pointer-events-auto")} />
            </div>
            <div>
              <div className="text-xs font-semibold mb-1 text-muted-foreground">إلى</div>
              <Calendar mode="single" selected={tempTo} onSelect={setTempTo} className={cn("p-0 pointer-events-auto")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button size="sm" variant="ghost" onClick={() => setOpenCustom(false)}>إلغاء</Button>
            <Button size="sm" onClick={applyCustom} disabled={!tempFrom || !tempTo}>تطبيق</Button>
          </div>
        </PopoverContent>
      </Popover>

      {activeKey !== "all" && (
        <span className="text-xs text-accent font-bold px-2">{value.label}</span>
      )}
    </div>
  );
}