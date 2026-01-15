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
  
  return (
    <Card className="overflow-hidden border bg-card hover:shadow-sm transition-shadow">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-medium text-foreground text-sm">{title}</h3>
        </div>
        
        {/* Stats - Simple inline */}
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-2xl font-bold text-foreground">{remaining}</span>
          <span className="text-sm text-muted-foreground">/ {total} يوم</span>
        </div>

        {/* Progress Bar - Subtle */}
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            مستخدم {used} يوم
          </div>
        </div>
      </div>
    </Card>
  );
}
