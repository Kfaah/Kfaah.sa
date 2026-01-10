import { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, Play, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatNumberPlain } from "@/lib/utils";
import { DailyTasksSelector } from "@/components/tasks/DailyTasksSelector";

interface AttendanceWidgetProps {
  userId: string;
  collapsed: boolean;
}

export const AttendanceWidget = ({ userId, collapsed }: AttendanceWidgetProps) => {
  const { toast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [processingCheckOut, setProcessingCheckOut] = useState(false);

  useEffect(() => {
    checkTodayAttendance();

    // الاستماع للتغييرات
    const channel = supabase
      .channel('attendance-widget')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${userId}`
        },
        () => {
          checkTodayAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // تحديث العداد كل ثانية
  useEffect(() => {
    if (!isCheckedIn || !checkInTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - checkInTime.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setElapsedTime({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [isCheckedIn, checkInTime]);

  const checkTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setIsCheckedIn(!data.check_out_at);
        if (!data.check_out_at) {
          setCheckInTime(new Date(data.check_in_at));
        }
      } else {
        setIsCheckedIn(false);
        setCheckInTime(null);
      }
    } catch (error: any) {
      console.error("Error checking attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInClick = () => {
    // فتح نافذة اختيار المهمة
    setShowTaskSelector(true);
  };

  const handleTaskSelected = async (taskId: string) => {
    setShowTaskSelector(false);
    
    // إذا لم يتم اختيار مهمة (لا توجد مهام)
    if (!taskId) {
      // تسجيل الحضور بدون مهمة
      await recordCheckIn();
      return;
    }
    
    // تسجيل الحضور مع المهمة
    await recordCheckIn();
    
    toast({ 
      title: "تم تسجيل الحضور ✓", 
      description: "تم بدء المهمة المختارة" 
    });
  };

  const recordCheckIn = async () => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const { error } = await supabase
        .from("attendance")
        .insert({
          user_id: userId,
          date: today,
          check_in_at: now.toISOString()
        });
      
      if (error) throw error;
      
      setIsCheckedIn(true);
      setCheckInTime(now);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const handleCheckOut = async () => {
    setProcessingCheckOut(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // تسجيل الانصراف
      const { error: attendanceError } = await supabase
        .from("attendance")
        .update({ check_out_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("date", today);
      
      if (attendanceError) throw attendanceError;
      
      // إنهاء أي مهمة نشطة
      const { data: activeTask } = await supabase
        .from("active_task")
        .select("task_id")
        .eq("user_id", userId)
        .maybeSingle();
      
      if (activeTask) {
        // تحديث المهمة
        await supabase
          .from("tasks")
          .update({ status: "executed" })
          .eq("id", activeTask.task_id);
        
        // حذف المهمة النشطة
        await supabase
          .from("active_task")
          .delete()
          .eq("user_id", userId);
      }
      
      setIsCheckedIn(false);
      setCheckInTime(null);
      setElapsedTime({ hours: 0, minutes: 0, seconds: 0 });
      
      toast({ title: "تم تسجيل الانصراف ✓" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setProcessingCheckOut(false);
    }
  };

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  if (loading) {
    return (
      <div className="bg-white/90 rounded-xl p-3 shadow-md animate-pulse">
        <div className="h-10 bg-slate-200 rounded"></div>
      </div>
    );
  }

  return (
    <>
      <div className={cn(
        "bg-white/90 rounded-xl shadow-md overflow-hidden transition-all",
        collapsed ? "p-2" : "p-3"
      )}>
        {isCheckedIn ? (
          // حالة الحضور - عرض العداد وزر الانصراف
          <div className="space-y-2">
            {!collapsed && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-700">تم الحضور</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                  منذ {formatNumberPlain(elapsedTime.hours)}:{formatTime(elapsedTime.minutes)}
                </Badge>
              </div>
            )}
            
            {/* العداد */}
            <div className={cn(
              "bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 flex items-center justify-center",
              collapsed ? "p-2" : "p-3"
            )}>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span 
                  className="text-2xl font-bold text-emerald-700 tabular-nums"
                  style={{ fontFamily: 'Arial, sans-serif' }}
                >
                  {formatTime(elapsedTime.hours)}:{formatTime(elapsedTime.minutes)}:{formatTime(elapsedTime.seconds)}
                </span>
              </div>
            </div>
            
            {/* زر الانصراف */}
            <Button
              onClick={handleCheckOut}
              disabled={processingCheckOut}
              className={cn(
                "w-full gap-2 bg-rose-500 hover:bg-rose-600",
                collapsed && "p-2"
              )}
            >
              {processingCheckOut ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  {!collapsed && <span>تسجيل الانصراف</span>}
                </>
              )}
            </Button>
          </div>
        ) : (
          // حالة عدم الحضور - زر تسجيل الحضور
          <Button
            onClick={handleCheckInClick}
            className={cn(
              "w-full gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600",
              collapsed && "p-2"
            )}
          >
            <LogIn className="w-4 h-4" />
            {!collapsed && <span>تسجيل الحضور</span>}
          </Button>
        )}
      </div>

      {/* نافذة اختيار المهمة */}
      <DailyTasksSelector
        open={showTaskSelector}
        userId={userId}
        onTaskSelected={handleTaskSelected}
      />
    </>
  );
};
