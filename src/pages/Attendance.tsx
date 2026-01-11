import { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, Check, ListTodo, Bell, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { cn, formatNumberPlain } from "@/lib/utils";
import { DailyTasksSelector } from "@/components/tasks/DailyTasksSelector";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

interface ActiveTask {
  task_id: string;
  started_at: string;
  task: Task;
}

export default function Attendance() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { previewingEmployee } = useUser();
  
  // Use previewing employee's user_id if in preview mode, otherwise use auth user's id
  const effectiveUserId = previewingEmployee?.user_id || user?.id;
  
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [elapsedTime, setElapsedTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [processingCheckOut, setProcessingCheckOut] = useState(false);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [taskElapsed, setTaskElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (effectiveUserId) {
      checkTodayAttendance();
      fetchTodayTasks();
      fetchActiveTask();
    }
  }, [effectiveUserId]);

  // تحديث عداد الحضور كل ثانية
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

  // تحديث عداد المهمة كل ثانية
  useEffect(() => {
    if (!activeTask) return;

    const interval = setInterval(() => {
      const now = new Date();
      const startedAt = new Date(activeTask.started_at);
      const diff = now.getTime() - startedAt.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTaskElapsed({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTask]);

  const checkTodayAttendance = async () => {
    if (!effectiveUserId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", effectiveUserId)
        .eq("date", today)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setCheckInTime(new Date(data.check_in_at));
        if (data.check_out_at) {
          // Already completed today
          setIsCheckedIn(false);
          setCheckOutTime(new Date(data.check_out_at));
          setHasCompletedToday(true);
        } else {
          // Currently checked in
          setIsCheckedIn(true);
          setCheckOutTime(null);
          setHasCompletedToday(false);
        }
      } else {
        setIsCheckedIn(false);
        setCheckInTime(null);
        setCheckOutTime(null);
        setHasCompletedToday(false);
      }
    } catch (error: any) {
      console.error("Error checking attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayTasks = async () => {
    if (!effectiveUserId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", effectiveUserId)
        .eq("due_date", today)
        .order("priority", { ascending: false });
      
      if (error) throw error;
      setTodayTasks(data || []);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchActiveTask = async () => {
    if (!effectiveUserId) return;
    try {
      const { data, error } = await supabase
        .from("active_task")
        .select(`
          task_id,
          started_at,
          task:tasks(id, title, status, priority, due_date)
        `)
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      if (error) throw error;
      if (data && data.task) {
        setActiveTask({
          task_id: data.task_id,
          started_at: data.started_at,
          task: data.task as unknown as Task
        });
      }
    } catch (error: any) {
      console.error("Error fetching active task:", error);
    }
  };

  const handleCheckInClick = () => {
    setShowTaskSelector(true);
  };

  const handleTaskSelected = async (taskId: string) => {
    setShowTaskSelector(false);
    
    if (!taskId) {
      await recordCheckIn();
      return;
    }
    
    await recordCheckIn();
    
    toast({ 
      title: "تم تسجيل الحضور ✓", 
      description: "تم بدء المهمة المختارة" 
    });
    
    fetchActiveTask();
  };

  const recordCheckIn = async () => {
    if (!effectiveUserId) return;
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Check if there's already an attendance record for today
      const { data: existingRecord } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", effectiveUserId)
        .eq("date", today)
        .maybeSingle();
      
      if (existingRecord) {
        // If already checked in and not checked out, just update state
        if (!existingRecord.check_out_at) {
          setIsCheckedIn(true);
          setCheckInTime(new Date(existingRecord.check_in_at));
          return;
        }
        // If already checked out today, don't allow another check-in
        toast({ 
          title: "تنبيه", 
          description: "لقد سجلت الحضور والانصراف لهذا اليوم بالفعل",
          variant: "destructive" 
        });
        return;
      }
      
      const { error } = await supabase
        .from("attendance")
        .insert({
          user_id: effectiveUserId,
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
    if (!effectiveUserId) return;
    setProcessingCheckOut(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error: attendanceError } = await supabase
        .from("attendance")
        .update({ check_out_at: new Date().toISOString() })
        .eq("user_id", effectiveUserId)
        .eq("date", today);
      
      if (attendanceError) throw attendanceError;
      
      const { data: activeTaskData } = await supabase
        .from("active_task")
        .select("task_id")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      if (activeTaskData) {
        await supabase
          .from("tasks")
          .update({ status: "executed" })
          .eq("id", activeTaskData.task_id);
        
        await supabase
          .from("active_task")
          .delete()
          .eq("user_id", effectiveUserId);
      }
      
      setIsCheckedIn(false);
      setCheckInTime(null);
      setElapsedTime({ hours: 0, minutes: 0, seconds: 0 });
      setActiveTask(null);
      
      toast({ title: "تم تسجيل الانصراف ✓" });
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setProcessingCheckOut(false);
    }
  };

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-300";
      case "medium": return "bg-amber-100 text-amber-700 border-amber-300";
      case "low": return "bg-green-100 text-green-700 border-green-300";
      default: return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "high": return "عالية";
      case "medium": return "متوسطة";
      case "low": return "منخفضة";
      default: return priority;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">تسجيل الحضور والانصراف</h1>
            <p className="text-slate-600 mt-1">
              {format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}
            </p>
          </div>
          <Badge className={isCheckedIn ? "bg-emerald-100 text-emerald-700" : hasCompletedToday ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"}>
            {isCheckedIn ? "حاضر" : hasCompletedToday ? "مكتمل" : "غير مسجل"}
          </Badge>
        </div>

        {/* Main Attendance Card */}
        <Card className="border-2 border-accent/20 shadow-xl">
          <CardContent className="p-8">
            {isCheckedIn ? (
              <div className="space-y-6">
                {/* Status */}
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-emerald-700">تم تسجيل الحضور</p>
                    <p className="text-sm text-slate-500">
                      منذ الساعة {checkInTime ? format(checkInTime, "hh:mm a", { locale: ar }) : ""}
                    </p>
                  </div>
                </div>

                {/* Timer */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 p-8 text-center">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Clock className="w-8 h-8 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-600">وقت العمل</span>
                  </div>
                  <div 
                    className="text-5xl font-bold text-emerald-700 tabular-nums"
                    style={{ fontFamily: 'Arial, sans-serif' }}
                  >
                    {formatTime(elapsedTime.hours)}:{formatTime(elapsedTime.minutes)}:{formatTime(elapsedTime.seconds)}
                  </div>
                </div>

                {/* Check Out Button */}
                <Button
                  onClick={handleCheckOut}
                  disabled={processingCheckOut}
                  size="lg"
                  className="w-full gap-3 bg-rose-500 hover:bg-rose-600 text-lg py-6"
                >
                  {processingCheckOut ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <LogOut className="w-6 h-6" />
                      <span>تسجيل الانصراف</span>
                    </>
                  )}
                </Button>
              </div>
            ) : hasCompletedToday ? (
              // Completed attendance view
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center">
                    <Check className="w-8 h-8 text-sky-600" />
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold text-sky-700">تم تسجيل الحضور والانصراف لهذا اليوم</h2>
                  <p className="text-slate-600 mt-2">شكراً لك على عملك اليوم!</p>
                </div>

                {/* Today's Attendance Summary */}
                <div className="bg-gradient-to-br from-sky-50 to-cyan-50 rounded-2xl border-2 border-sky-200 p-6">
                  <h3 className="text-lg font-bold text-sky-800 mb-4 text-center">ملخص حضور اليوم</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <LogIn className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-medium text-slate-600">وقت الحضور</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700" style={{ fontFamily: 'Arial, sans-serif' }}>
                        {checkInTime ? format(checkInTime, "hh:mm a", { locale: ar }) : "-"}
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <LogOut className="w-5 h-5 text-rose-600" />
                        <span className="text-sm font-medium text-slate-600">وقت الانصراف</span>
                      </div>
                      <p className="text-2xl font-bold text-rose-700" style={{ fontFamily: 'Arial, sans-serif' }}>
                        {checkOutTime ? format(checkOutTime, "hh:mm a", { locale: ar }) : "-"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Total Work Hours */}
                  {checkInTime && checkOutTime && (
                    <div className="mt-4 bg-white rounded-xl p-4 text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-accent" />
                        <span className="text-sm font-medium text-slate-600">إجمالي ساعات العمل</span>
                      </div>
                      <p className="text-2xl font-bold text-accent" style={{ fontFamily: 'Arial, sans-serif' }}>
                        {(() => {
                          const diff = checkOutTime.getTime() - checkInTime.getTime();
                          const hours = Math.floor(diff / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          return `${hours} ساعة ${minutes} دقيقة`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                  <Clock className="w-10 h-10 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">مرحباً بك</h2>
                  <p className="text-slate-600 mt-1">اضغط على الزر أدناه لتسجيل الحضور وبدء يوم العمل</p>
                </div>
                <Button
                  onClick={handleCheckInClick}
                  size="lg"
                  className="w-full gap-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-lg py-6"
                >
                  <LogIn className="w-6 h-6" />
                  <span>تسجيل الحضور</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Task */}
        {activeTask && (
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <ListTodo className="w-5 h-5" />
                المهمة الحالية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{activeTask.task.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getPriorityColor(activeTask.task.priority)}>
                      {getPriorityText(activeTask.task.priority)}
                    </Badge>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-500">وقت العمل على المهمة</p>
                  <p 
                    className="text-xl font-bold text-amber-700 tabular-nums"
                    style={{ fontFamily: 'Arial, sans-serif' }}
                  >
                    {formatTime(taskElapsed.hours)}:{formatTime(taskElapsed.minutes)}:{formatTime(taskElapsed.seconds)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              مهام اليوم
              <Badge variant="secondary">{todayTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد مهام مجدولة لهذا اليوم</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <div 
                    key={task.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      activeTask?.task_id === task.id 
                        ? "bg-amber-50 border-amber-300" 
                        : "bg-white border-slate-200 hover:border-accent/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {activeTask?.task_id === task.id && (
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        <span className="font-medium text-slate-800">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(task.priority)}>
                          {getPriorityText(task.priority)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {task.status === "pending" && "قيد الانتظار"}
                          {task.status === "in_progress" && "قيد التنفيذ"}
                          {task.status === "executed" && "منفذة"}
                          {task.status === "completed" && "مكتملة"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Selector Dialog */}
      {effectiveUserId && (
        <DailyTasksSelector
          open={showTaskSelector}
          userId={effectiveUserId}
          onTaskSelected={handleTaskSelected}
        />
      )}
    </DashboardLayout>
  );
}
