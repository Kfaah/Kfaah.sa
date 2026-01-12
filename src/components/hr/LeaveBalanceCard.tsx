import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
  const percentage = total > 0 ? (used / total) * 100 : 0;
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">المتبقي</span>
            <span className="font-bold text-foreground">{remaining} يوم</span>
          </div>
          
          <Progress value={100 - percentage} className="h-2" />
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>مستخدم: {used}</span>
            <span>الإجمالي: {total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
