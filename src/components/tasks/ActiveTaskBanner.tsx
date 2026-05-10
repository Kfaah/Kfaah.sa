import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  PlayCircle, 
  CheckCircle, 
  Clock,
  ArrowLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LiveTimer } from "./LiveTimer";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  estimated_time_minutes: number | null;
  started_at: string | null;
}

interface ActiveTaskBannerProps {
  userId: string;
  onTaskCompleted: () => void;
  onSelectNextTask: () => void;
}

export const ActiveTaskBanner = ({ userId, onTaskCompleted, onSelectNextTask }: ActiveTaskBannerProps) => {
  const { toast } = useToast();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetchActiveTask();
    
    // الاستماع للتغييرات
    const channel = supabase
      .channel('active-task-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_task',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchActiveTask();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchActiveTask = async () => {
    try {
      const { data: activeTaskData, error: activeError } = await supabase
        .from("active_task")
        .select("task_id, started_at")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (activeError) throw activeError;
      
      if (activeTaskData) {
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("id, title, estimated_time_minutes, started_at")
          .eq("id", activeTaskData.task_id)
          .maybeSingle();
        
        if (taskError) throw taskError;
        
        if (taskData) {
          setActiveTask({
            ...taskData,
            started_at: activeTaskData.started_at || taskData.started_at
          } as Task);
        }
      } else {
        setActiveTask(null);
      }
    } catch (error: any) {
      console.error("Error fetching active task:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!activeTask) return;
    
    setCompleting(true);
    try {
      const now = new Date();
      const startTime = activeTask.started_at ? new Date(activeTask.started_at).getTime() : now.getTime();
      const actualMinutes = Math.round((now.getTime() - startTime) / (1000 * 60));

      // تحديث المهمة
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ 
          status: "executed",
          actual_time_minutes: actualMinutes
        })
        .eq("id", activeTask.id);
      
      if (taskError) throw taskError;
      
      // حذف المهمة النشطة
      const { error: activeError } = await supabase
        .from("active_task")
        .delete()
        .eq("user_id", userId);
      
      if (activeError) throw activeError;
      
      toast({ 
        title: "تم إنهاء المهمة ✓", 
        description: `استغرقت ${actualMinutes} دقيقة` 
      });
      
      setActiveTask(null);
      onTaskCompleted();
      
      // فتح اختيار المهمة التالية
      onSelectNextTask();

      // 🤖 Fire-and-forget: تقييم آلي للجودة + تعبئة الوقت المتبقي للموظف
      try {
        // اجلب org_id للمهمة
        const { data: tk } = await supabase
          .from("tasks").select("organization_id").eq("id", activeTask.id).maybeSingle();
        const orgId = (tk as any)?.organization_id;
        // تقييم آلي
        supabase.functions.invoke("evaluate-task-quality", { body: { taskId: activeTask.id } })
          .catch((e) => console.warn("evaluate-task-quality failed", e));
        // تعبئة الوقت المتبقي للموظف
        if (orgId) {
          supabase.functions.invoke("top-up-employee-tasks", { body: { organization_id: orgId, user_id: userId } })
            .catch((e) => console.warn("top-up failed", e));
        }
      } catch (e) {
        console.warn("post-completion hooks failed", e);
      }
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return null;
  if (!activeTask) return null;

  return (
    <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/30 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <PlayCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">المهمة الحالية:</span>
              <Badge className="bg-accent/20 text-accent border-accent/30">
                قيد التنفيذ
              </Badge>
            </div>
            <h3 className="font-semibold text-foreground text-lg">{activeTask.title}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {activeTask.started_at && (
            <div className="bg-white/80 rounded-lg px-4 py-2 border">
              <LiveTimer 
                startedAt={activeTask.started_at} 
                estimatedMinutes={activeTask.estimated_time_minutes}
              />
            </div>
          )}
          
          <Button
            onClick={handleCompleteTask}
            disabled={completing}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {completing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                إنهاء المهمة
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
