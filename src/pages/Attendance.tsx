import { useState, useEffect } from "react";
import { Clock, LogIn, LogOut, Check, ListTodo, Bell, Calendar as CalendarIcon, History, Users, TrendingUp, FileText, Filter, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUser } from "@/contexts/UserContext";
import { cn, formatNumberPlain, formatDate } from "@/lib/utils";
import { DailyTasksSelector } from "@/components/tasks/DailyTasksSelector";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { format, startOfMonth, endOfMonth, differenceInMinutes, parse } from "date-fns";
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
  const { previewingEmployee, previewAsEmployee, user: userData } = useUser();
  
  // Check if user is admin (not previewing)
  const isAdmin = !previewAsEmployee && userData.role === "مدير النظام";
  
  // Use previewing employee's user_id if in preview mode, otherwise use auth user's id
  const effectiveUserId = previewingEmployee?.user_id || user?.id;

  // Get local date in YYYY-MM-DD format (not UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
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
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Admin state
  const [adminRecords, setAdminRecords] = useState<any[]>([]);
  const [adminEmployees, setAdminEmployees] = useState<any[]>([]);
  const [adminDateFilter, setAdminDateFilter] = useState<string>(getLocalDateString());
  const [adminSelectedEmployee, setAdminSelectedEmployee] = useState<string>("all");
  const [adminStats, setAdminStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    averageHoursThisMonth: 0,
  });

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    } else if (effectiveUserId) {
      checkTodayAttendance();
      fetchTodayTasks();
      fetchActiveTask();
      fetchAttendanceHistory();
    }
  }, [effectiveUserId, isAdmin]);

  // Fetch admin data when filters change
  useEffect(() => {
    if (isAdmin) {
      fetchAdminRecords();
      fetchAdminStats();
    }
  }, [adminDateFilter, adminSelectedEmployee, isAdmin]);

  const fetchAdminData = async () => {
    try {
      // Fetch employees
      const { data: empData } = await supabase
        .from("employees")
        .select("id, user_id, full_name, job_role, avatar_url")
        .eq("status", "active")
        .order("full_name");
      
      setAdminEmployees(empData || []);
      await fetchAdminRecords();
      await fetchAdminStats();
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminRecords = async () => {
    try {
      let query = supabase
        .from("attendance")
        .select("*")
        .eq("date", adminDateFilter)
        .order("check_in_at", { ascending: false });
      
      if (adminSelectedEmployee !== "all") {
        const selectedEmp = adminEmployees.find(e => e.id === adminSelectedEmployee);
        if (selectedEmp?.user_id) {
          query = query.eq("user_id", selectedEmp.user_id);
        }
      }
      
      const { data: attendanceData } = await query;
      
      // Create employee map
      const { data: empData } = await supabase
        .from("employees")
        .select("user_id, full_name, job_role, avatar_url");
      
      const employeeMap = new Map(empData?.map(e => [e.user_id, e]) || []);
      
      const recordsWithEmployees = (attendanceData || []).map(record => ({
        ...record,
        employee: employeeMap.get(record.user_id)
      }));
      
      setAdminRecords(recordsWithEmployees);
    } catch (error) {
      console.error("Error fetching admin records:", error);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const today = getLocalDateString();
      const monthStart = startOfMonth(new Date()).toISOString().split('T')[0];
      const monthEnd = endOfMonth(new Date()).toISOString().split('T')[0];

      const { count: totalEmployees } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { data: todayAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today);

      const { data: monthAttendance } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .not("check_out_at", "is", null);

      let totalMinutes = 0;
      let completedRecords = 0;

      monthAttendance?.forEach(record => {
        if (record.check_out_at) {
          const checkIn = new Date(record.check_in_at);
          const checkOut = new Date(record.check_out_at);
          totalMinutes += differenceInMinutes(checkOut, checkIn);
          completedRecords++;
        }
      });

      const averageHours = completedRecords > 0 ? (totalMinutes / completedRecords / 60) : 0;

      setAdminStats({
        totalEmployees: totalEmployees || 0,
        presentToday: todayAttendance?.length || 0,
        absentToday: (totalEmployees || 0) - (todayAttendance?.length || 0),
        averageHoursThisMonth: Math.round(averageHours * 10) / 10,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    }
  };

  const calculateWorkDuration = (checkIn: string, checkOut: string | null): string => {
    if (!checkOut) return "جاري العمل";
    
    const minutes = differenceInMinutes(new Date(checkOut), new Date(checkIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0 && mins === 0) {
      const seconds = Math.floor((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 1000);
      return `${seconds} ثانية`;
    } else if (hours === 0) {
      return `${mins} دقيقة`;
    }
    return `${hours} ساعة ${mins} دقيقة`;
  };

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
      const today = getLocalDateString();
      
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
      const today = getLocalDateString();
      
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

  const fetchAttendanceHistory = async () => {
    if (!effectiveUserId) return;
    try {
      const today = getLocalDateString();
      
      // Fetch only previous days (not today)
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", effectiveUserId)
        .not("check_out_at", "is", null)
        .lt("date", today)
        .order("date", { ascending: false })
        .limit(30);
      
      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (error: any) {
      console.error("Error fetching attendance history:", error);
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
      const today = getLocalDateString();
      
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
        setHasCompletedToday(true);
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
      setHasCompletedToday(false);
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  };

  const handleCheckOut = async () => {
    if (!effectiveUserId) return;
    setProcessingCheckOut(true);
    try {
      const today = getLocalDateString();
      
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

  // Admin View
  if (isAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <Clock className="w-7 h-7 text-accent" />
                الحضور والانصراف
              </h1>
              <p className="text-muted-foreground mt-1">
                {format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                    <p className="text-2xl font-bold text-foreground">{adminStats.totalEmployees}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الحاضرون اليوم</p>
                    <p className="text-2xl font-bold text-emerald-600">{adminStats.presentToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                    <LogOut className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الغائبون اليوم</p>
                    <p className="text-2xl font-bold text-rose-600">{adminStats.absentToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">متوسط ساعات العمل</p>
                    <p className="text-2xl font-bold text-amber-600">{adminStats.averageHoursThisMonth}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-border/50 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Date Filter with Calendar Picker */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">التاريخ:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="justify-start text-right font-normal gap-0"
                      >
                        <CalendarIcon className="w-4 h-4 text-muted-foreground ml-2" />
                        {adminDateFilter ? (
                          <span className="flex items-center" style={{ fontFamily: 'Arial, sans-serif' }}>
                            <span className="font-bold">{format(parse(adminDateFilter, 'yyyy-MM-dd', new Date()), 'd')}</span>
                            <span className="mx-1">-</span>
                            <span>{format(parse(adminDateFilter, 'yyyy-MM-dd', new Date()), 'M')}</span>
                            <span className="mx-1">-</span>
                            <span>{format(parse(adminDateFilter, 'yyyy-MM-dd', new Date()), 'yyyy')}</span>
                          </span>
                        ) : (
                          <span>اختر التاريخ</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={adminDateFilter ? parse(adminDateFilter, 'yyyy-MM-dd', new Date()) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setAdminDateFilter(`${year}-${month}-${day}`);
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Employee Filter */}
                <div className="w-64">
                  <Select value={adminSelectedEmployee} onValueChange={setAdminSelectedEmployee}>
                    <SelectTrigger className="w-full bg-white border-border">
                      <Users className="w-4 h-4 text-muted-foreground ml-2" />
                      <SelectValue placeholder="جميع الموظفين" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="all">جميع الموظفين</SelectItem>
                      {adminEmployees.map((emp: any) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} - {emp.job_role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Records */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                سجلات الحضور
                <Badge variant="secondary">{adminRecords.length} سجل</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد سجلات حضور لهذا اليوم</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-accent hover:bg-accent">
                        <TableHead className="text-center font-bold text-white">الموظف</TableHead>
                        <TableHead className="text-center font-bold text-white">الوظيفة</TableHead>
                        <TableHead className="text-center font-bold text-white">وقت الحضور</TableHead>
                        <TableHead className="text-center font-bold text-white">وقت الانصراف</TableHead>
                        <TableHead className="text-center font-bold text-white">مدة العمل</TableHead>
                        <TableHead className="text-center font-bold text-white">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminRecords.map((record: any, index: number) => (
                        <TableRow key={record.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <TableCell className="text-center font-medium">
                            <div className="flex items-center justify-center gap-2">
                              {record.employee?.avatar_url ? (
                                <img 
                                  src={record.employee.avatar_url} 
                                  alt="" 
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                                  <Users className="w-4 h-4 text-accent" />
                                </div>
                              )}
                              <span>{record.employee?.full_name || "غير معروف"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {record.employee?.job_role || "-"}
                          </TableCell>
                          <TableCell className="text-center text-emerald-600 font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {format(new Date(record.check_in_at), "hh:mm a", { locale: ar })}
                          </TableCell>
                          <TableCell className="text-center text-rose-600 font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {record.check_out_at 
                              ? format(new Date(record.check_out_at), "hh:mm a", { locale: ar })
                              : "-"
                            }
                          </TableCell>
                          <TableCell className="text-center font-bold text-accent" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {calculateWorkDuration(record.check_in_at, record.check_out_at)}
                          </TableCell>
                          <TableCell className="text-center">
                            {record.check_out_at ? (
                              <Badge className="bg-sky-100 text-sky-700 border-sky-200">مكتمل</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">حاضر</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Employee View
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
                          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                          
                          if (hours === 0 && minutes === 0) {
                            return `${seconds} ثانية`;
                          } else if (hours === 0) {
                            return `${minutes} دقيقة`;
                          }
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

        {/* Attendance History Table */}
        {attendanceHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-accent" />
                سجل الحضور والانصراف
                <Badge variant="secondary">{attendanceHistory.length} يوم</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#3d9aa8] hover:bg-[#3d9aa8]">
                      <TableHead className="text-center font-bold text-white">اليوم</TableHead>
                      <TableHead className="text-center font-bold text-white">التاريخ</TableHead>
                      <TableHead className="text-center font-bold text-white">وقت الحضور</TableHead>
                      <TableHead className="text-center font-bold text-white">وقت الانصراف</TableHead>
                      <TableHead className="text-center font-bold text-white">إجمالي الوقت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showAllHistory ? attendanceHistory : attendanceHistory.slice(0, 7)).map((record, index) => {
                      const checkIn = new Date(record.check_in_at);
                      const checkOut = new Date(record.check_out_at);
                      const diff = checkOut.getTime() - checkIn.getTime();
                      const hours = Math.floor(diff / (1000 * 60 * 60));
                      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                      
                      return (
                        <TableRow key={record.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <TableCell className="text-center font-medium">
                            {format(new Date(record.date), "EEEE", { locale: ar })}
                          </TableCell>
                          <TableCell className="text-center" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {formatDate(record.date)}
                          </TableCell>
                          <TableCell className="text-center text-emerald-600 font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {format(checkIn, "hh:mm a", { locale: ar })}
                          </TableCell>
                          <TableCell className="text-center text-rose-600 font-semibold" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {format(checkOut, "hh:mm a", { locale: ar })}
                          </TableCell>
                          <TableCell className="text-center font-bold text-accent" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {hours} س {minutes} د
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Show More Button */}
              {attendanceHistory.length > 7 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="gap-2"
                  >
                    {showAllHistory ? "عرض أقل" : `عرض المزيد (${attendanceHistory.length - 7} يوم آخر)`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
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
