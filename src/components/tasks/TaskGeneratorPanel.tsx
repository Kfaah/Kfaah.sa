import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  RefreshCcw,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { 
  generateDailyTasks, 
  getCurrentArabicDay, 
  isWorkDay,
  scheduleInfo,
  type Plan,
  type TaskGenerationResult,
} from "@/services/taskGenerator";
import { toast } from "@/hooks/use-toast";

interface TaskGeneratorPanelProps {
  plans: Plan[];
  onTasksGenerated?: (result: TaskGenerationResult) => void;
}

const TaskGeneratorPanel = ({ plans, onTasksGenerated }: TaskGeneratorPanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<TaskGenerationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const currentDay = getCurrentArabicDay();
  const workDay = isWorkDay();
  
  const handleGenerateTasks = async () => {
    setIsGenerating(true);
    
    // محاكاة تأخير للعرض
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const result = generateDailyTasks(plans);
    setLastResult(result);
    
    if (result.totalGenerated > 0) {
      toast({
        title: "تم توليد المهام بنجاح",
        description: `تم إنشاء ${result.totalGenerated} مهمة جديدة`,
      });
    } else if (!result.isWorkDay) {
      toast({
        title: "اليوم عطلة",
        description: `${currentDay} ليس من أيام العمل`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "لم يتم توليد مهام",
        description: "تحقق من الخطط النشطة والموظفين المعينين",
        variant: "destructive",
      });
    }
    
    onTasksGenerated?.(result);
    setIsGenerating(false);
  };
  
  const activePlans = plans.filter((p) => p.isActive);
  const todayPlans = activePlans.filter((p) => p.workDays.includes(currentDay));
  
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">نظام التوليد التلقائي</CardTitle>
              <CardDescription>
                توليد المهام اليومية بناءً على الخطط المعرّفة
              </CardDescription>
            </div>
          </div>
          <Badge variant={workDay ? "default" : "secondary"} className="gap-1">
            <Calendar className="w-3 h-3" />
            {currentDay}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* حالة اليوم */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
          <div className="flex items-center gap-2">
            {workDay ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <span className="text-sm">
              {workDay ? "يوم عمل - جاهز للتوليد" : "يوم عطلة - لا توليد تلقائي"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>التوليد الآلي: {scheduleInfo.time} صباحاً</span>
          </div>
        </div>
        
        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <p className="text-2xl font-bold text-primary">{activePlans.length}</p>
            <p className="text-xs text-muted-foreground">خطة نشطة</p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <p className="text-2xl font-bold text-green-500">{todayPlans.length}</p>
            <p className="text-xs text-muted-foreground">خطة لليوم</p>
          </div>
          <div className="p-3 rounded-lg bg-background/50 text-center">
            <p className="text-2xl font-bold text-blue-500">
              {todayPlans.reduce((acc, p) => acc + p.taskTemplates.length, 0)}
            </p>
            <p className="text-xs text-muted-foreground">مهمة متوقعة</p>
          </div>
        </div>
        
        {/* زر التوليد */}
        <Button 
          className="w-full gap-2" 
          size="lg"
          onClick={handleGenerateTasks}
          disabled={isGenerating || !workDay}
        >
          {isGenerating ? (
            <>
              <RefreshCcw className="w-4 h-4 animate-spin" />
              جاري التوليد...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              توليد مهام اليوم الآن
            </>
          )}
        </Button>
        
        {/* نتيجة آخر توليد */}
        {lastResult && (
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between"
              onClick={() => setShowDetails(!showDetails)}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                آخر توليد: {lastResult.totalGenerated} مهمة
              </span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            
            {showDetails && (
              <div className="p-3 rounded-lg bg-background/50 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  تاريخ التوليد: {lastResult.generatedAt}
                </p>
                {lastResult.skippedPlans.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">الخطط المتجاوزة:</p>
                    {lastResult.skippedPlans.map((skip) => (
                      <p key={skip.planId} className="text-muted-foreground text-xs">
                        • {skip.planName}: {skip.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* أيام العمل */}
        <div className="flex items-center justify-center gap-1 pt-2">
          {scheduleInfo.workDays.map((day) => (
            <Badge 
              key={day} 
              variant={day === currentDay ? "default" : "outline"}
              className="text-xs"
            >
              {day}
            </Badge>
          ))}
          <span className="mx-2 text-muted-foreground">|</span>
          {scheduleInfo.weekend.map((day) => (
            <Badge 
              key={day} 
              variant="secondary"
              className="text-xs opacity-50"
            >
              {day}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskGeneratorPanel;
