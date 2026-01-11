import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  PlayCircle, 
  Calendar, 
  AlertTriangle,
  Target,
  CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatNumberPlain } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: string;
  due_date: string | null;
  estimated_time_minutes: number | null;
}

interface DailyTasksSelectorProps {
  open: boolean;
  userId: string;
  onTaskSelected: (taskId: string) => void;
}

const PRIORITY_CONFIG = {
  high: { label: "عاجلة", class: "bg-rose-100 text-rose-700 border-rose-300" },
  medium: { label: "متوسطة", class: "bg-amber-100 text-amber-700 border-amber-300" },
  low: { label: "عادية", class: "bg-emerald-100 text-emerald-700 border-emerald-300" },
};

export const DailyTasksSelector = ({ open, userId, onTaskSelected }: DailyTasksSelectorProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchTodayTasks();
    }
  }, [open, userId]);

  const fetchTodayTasks = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, description, priority, status, due_date, estimated_time_minutes")
        .eq("user_id", userId)
        .eq("due_date", today)
        .in("status", ["upcoming", "in_progress"])
        .order("priority", { ascending: false });
      
      if (error) throw error;
      setTasks((data as Task[]) || []);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async () => {
    if (!selectedTaskId) return;
    
    setStarting(true);
    try {
      const now = new Date().toISOString();
      
      // تحديث حالة المهمة إلى قيد التنفيذ
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ 
          status: "in_progress",
          started_at: now 
        })
        .eq("id", selectedTaskId);
      
      if (taskError) throw taskError;
      
      // حفظ المهمة النشطة
      const { error: activeError } = await supabase
        .from("active_task")
        .upsert({
          user_id: userId,
          task_id: selectedTaskId,
          started_at: now,
        }, { onConflict: 'user_id' });
      
      if (activeError) throw activeError;
      
      toast({ title: "تم بدء المهمة ✓" });
      onTaskSelected(selectedTaskId);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            مهام اليوم - اختر مهمة للبدء
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-700">
              يجب اختيار مهمة للبدء قبل الوصول إلى النظام
            </p>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-foreground">لا توجد مهام لهذا اليوم</p>
              <p className="text-sm text-muted-foreground mt-2">يمكنك الوصول للنظام بدون اختيار مهمة</p>
              <Button 
                onClick={() => onTaskSelected("")} 
                className="mt-4 bg-accent hover:bg-accent/90"
              >
                متابعة
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const priorityConfig = PRIORITY_CONFIG[task.priority];
                    const isSelected = selectedTaskId === task.id;
                    
                    return (
                      <Card 
                        key={task.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          isSelected 
                            ? "ring-2 ring-accent border-accent bg-accent/5" 
                            : "hover:border-accent/50"
                        )}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-foreground">{task.title}</h4>
                                <Badge className={priorityConfig.class}>
                                  {priorityConfig.label}
                                </Badge>
                                {task.status === "in_progress" && (
                                  <Badge className="bg-sky-100 text-sky-700">
                                    قيد التنفيذ
                                  </Badge>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  <span style={{ fontFamily: 'Arial, sans-serif' }}>
                                    {formatDate(task.due_date)}
                                  </span>
                                </div>
                                {task.estimated_time_minutes && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span style={{ fontFamily: 'Arial, sans-serif' }}>
                                      {formatNumberPlain(task.estimated_time_minutes)} دقيقة
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className={cn(
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                              isSelected 
                                ? "border-accent bg-accent" 
                                : "border-muted-foreground/30"
                            )}>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
              
              <div className="flex justify-end mt-4 pt-4 border-t">
                <Button
                  onClick={handleStartTask}
                  disabled={!selectedTaskId || starting}
                  className="gap-2 bg-accent hover:bg-accent/90 min-w-[150px]"
                >
                  {starting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5" />
                      بدء المهمة
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
