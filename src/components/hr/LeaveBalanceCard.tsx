import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LeaveBalanceCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  total: number;
  used: number;
  remaining: number;
}

export function LeaveBalanceCard({ 
  title, 
  icon: Icon, 
  color, 
  total, 
  used, 
  remaining 
}: LeaveBalanceCardProps) {
  const percentage = total > 0 ? (remaining / total) * 100 : 0;
  
  // Extract color for styling
  const getColorClasses = (colorStr: string) => {
    if (colorStr.includes('emerald') || colorStr.includes('green') || colorStr.includes('#10b981')) {
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-400',
        progress: 'bg-emerald-500',
        progressBg: 'bg-emerald-100 dark:bg-emerald-900/50'
      };
    }
    if (colorStr.includes('amber') || colorStr.includes('yellow') || colorStr.includes('orange') || colorStr.includes('#f59e0b')) {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-400',
        progress: 'bg-amber-500',
        progressBg: 'bg-amber-100 dark:bg-amber-900/50'
      };
    }
    if (colorStr.includes('red') || colorStr.includes('#ef4444')) {
      return {
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-400',
        progress: 'bg-red-500',
        progressBg: 'bg-red-100 dark:bg-red-900/50'
      };
    }
    if (colorStr.includes('blue') || colorStr.includes('#3b82f6')) {
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-400',
        progress: 'bg-blue-500',
        progressBg: 'bg-blue-100 dark:bg-blue-900/50'
      };
    }
    if (colorStr.includes('violet') || colorStr.includes('purple') || colorStr.includes('#8b5cf6')) {
      return {
        bg: 'bg-violet-50 dark:bg-violet-950/30',
        border: 'border-violet-200 dark:border-violet-800',
        text: 'text-violet-700 dark:text-violet-400',
        progress: 'bg-violet-500',
        progressBg: 'bg-violet-100 dark:bg-violet-900/50'
      };
    }
    // Default
    return {
      bg: 'bg-primary/5',
      border: 'border-primary/20',
      text: 'text-primary',
      progress: 'bg-primary',
      progressBg: 'bg-primary/10'
    };
  };

  const colors = getColorClasses(color);
  
  return (
    <Card className={cn(
      "overflow-hidden border-2 transition-all hover:shadow-md",
      colors.bg,
      colors.border
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-sm", color)}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn("font-semibold text-sm truncate", colors.text)}>{title}</h3>
            <p className="text-xs text-muted-foreground">رصيد الإجازات</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-card border border-border">
            <div className={cn("text-lg font-bold", colors.text)}>{remaining}</div>
            <div className="text-[10px] text-muted-foreground">المتبقي</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-card border border-border">
            <div className="text-lg font-bold text-muted-foreground">{used}</div>
            <div className="text-[10px] text-muted-foreground">مستخدم</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-card border border-border">
            <div className="text-lg font-bold text-foreground">{total}</div>
            <div className="text-[10px] text-muted-foreground">الإجمالي</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">نسبة المتبقي</span>
            <span className={cn("font-medium", colors.text)}>{Math.round(percentage)}%</span>
          </div>
          <div className={cn("h-2 rounded-full overflow-hidden", colors.progressBg)}>
            <div 
              className={cn("h-full rounded-full transition-all duration-500", colors.progress)}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
