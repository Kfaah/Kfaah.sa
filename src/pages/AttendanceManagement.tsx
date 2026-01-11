import { useState, useEffect } from "react";
import { Clock, Users, Calendar, TrendingUp, AlertCircle, CheckCircle, XCircle, Search, Filter, Settings, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  job_role: string;
  avatar_url: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_at: string;
  check_out_at: string | null;
  employee?: {
    full_name: string;
    job_role: string;
    avatar_url: string | null;
  };
}

interface AttendanceStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  averageHoursThisMonth: number;
  lateArrivalsThisMonth: number;
}

export default function AttendanceManagement() {
  const { toast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(getLocalDateString());
  const [stats, setStats] = useState<AttendanceStats>({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    averageHoursThisMonth: 0,
    lateArrivalsThisMonth: 0
  });
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Get local date in YYYY-MM-DD format
  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendanceRecords();
    fetchStats();
  }, [dateFilter, selectedEmployeeId]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name, job_role, avatar_url, work_start_time, work_end_time")
        .eq("status", "active")
        .order("full_name");
      
      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchAttendanceRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("attendance")
        .select("*")
        .eq("date", dateFilter)
        .order("check_in_at", { ascending: false });
      
      // Filter by selected employee
      if (selectedEmployeeId !== "all") {
        const selectedEmp = employees.find(e => e.id === selectedEmployeeId);
        if (selectedEmp?.user_id) {
          query = query.eq("user_id", selectedEmp.user_id);
        }
      }
      
      const { data: attendanceData, error: attendanceError } = await query;
      
      if (attendanceError) throw attendanceError;

      // Fetch employees separately
      const { data: employeesData } = await supabase
        .from("employees")
        .select("user_id, full_name, job_role, avatar_url");

      const employeeMap = new Map(employeesData?.map(e => [e.user_id, e]) || []);
      
      const recordsWithEmployees: AttendanceRecord[] = (attendanceData || []).map(record => ({
        ...record,
        employee: employeeMap.get(record.user_id) as AttendanceRecord['employee']
      }));

      setRecords(recordsWithEmployees);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const today = getLocalDateString();
      const monthStart = startOfMonth(new Date()).toISOString().split('T')[0];
      const monthEnd = endOfMonth(new Date()).toISOString().split('T')[0];

      // Get total employees
      const { count: totalEmployees } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get today's attendance
      const { data: todayAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", today);

      // Get this month's attendance for average hours calculation
      const { data: monthAttendance } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .not("check_out_at", "is", null);

      // Calculate average hours
      let totalMinutes = 0;
      let completedRecords = 0;
      let lateArrivals = 0;

      monthAttendance?.forEach(record => {
        if (record.check_out_at) {
          const checkIn = new Date(record.check_in_at);
          const checkOut = new Date(record.check_out_at);
          totalMinutes += differenceInMinutes(checkOut, checkIn);
          completedRecords++;
        }
        
        // Consider late if checked in after 8:00 AM
        const checkInTime = new Date(record.check_in_at);
        if (checkInTime.getHours() >= 8 && checkInTime.getMinutes() > 0) {
          lateArrivals++;
        }
      });

      const averageHours = completedRecords > 0 ? (totalMinutes / completedRecords / 60) : 0;

      setStats({
        totalEmployees: totalEmployees || 0,
        presentToday: todayAttendance?.length || 0,
        absentToday: (totalEmployees || 0) - (todayAttendance?.length || 0),
        averageHoursThisMonth: Math.round(averageHours * 10) / 10,
        lateArrivalsThisMonth: lateArrivals
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const openScheduleDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setWorkStartTime(employee.work_start_time?.substring(0, 5) || "08:00");
    setWorkEndTime(employee.work_end_time?.substring(0, 5) || "16:00");
    setScheduleDialogOpen(true);
  };

  const saveSchedule = async () => {
    if (!selectedEmployee) return;
    
    setSavingSchedule(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          work_start_time: workStartTime,
          work_end_time: workEndTime
        })
        .eq("id", selectedEmployee.id);
      
      if (error) throw error;
      
      toast({ title: "تم حفظ جدول الدوام ✓" });
      setScheduleDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } finally {
      setSavingSchedule(false);
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

  const formatTime = (dateStr: string): string => {
    return format(new Date(dateStr), "hh:mm a", { locale: ar });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة الحضور والانصراف</h1>
            <p className="text-muted-foreground mt-1">
              مراقبة وإدارة سجلات حضور جميع الموظفين
            </p>
          </div>
          <Badge className="bg-accent/10 text-accent border-accent/20">
            {format(new Date(), "EEEE، d MMMM yyyy", { locale: ar })}
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalEmployees}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الحاضرون اليوم</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.presentToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الغائبون اليوم</p>
                  <p className="text-2xl font-bold text-rose-600">{stats.absentToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">متوسط ساعات العمل</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.averageHoursThisMonth}h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">التأخيرات هذا الشهر</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.lateArrivalsThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center justify-end">
              {/* Date Filter - Far Left */}
              <div className="relative w-44">
                <div className="flex items-center gap-1 border rounded-md px-3 py-2 bg-white">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {(() => {
                    const parts = dateFilter
                      ? (() => {
                          const [year, month, day] = dateFilter.split('-');
                          return { day, month, year };
                        })()
                      : { day: '--', month: '--', year: '----' };

                    return (
                      <span className="flex items-center gap-1 text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                        <span>{parts.day}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{parts.month}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{parts.year}</span>
                      </span>
                    );
                  })()}
                </div>

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="اختيار التاريخ"
                />
              </div>

              {/* Today Button */}
              <Button variant="outline" onClick={() => setDateFilter(getLocalDateString())} className="gap-2">
                <Calendar className="w-4 h-4" />
                اليوم
              </Button>

              {/* Employee Filter */}
              <div className="w-64">
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-full bg-white border-border flex flex-row-reverse justify-between">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="جميع الموظفين" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} - {emp.job_role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Work Schedule Settings - Far Right */}
              <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="w-4 h-4" />
                    إعدادات الدوام
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>إعدادات جدول الدوام</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>اختر الموظف</Label>
                      <Select
                        value={selectedEmployee?.id || ""}
                        onValueChange={(value) => {
                          const emp = employees.find((e) => e.id === value);
                          if (emp) openScheduleDialog(emp);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر موظف..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white z-50">
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedEmployee && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>وقت بداية الدوام</Label>
                            <Input
                              type="time"
                              value={workStartTime}
                              onChange={(e) => setWorkStartTime(e.target.value)}
                              className="text-center"
                              style={{ fontFamily: 'Arial, sans-serif' }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>وقت نهاية الدوام</Label>
                            <Input
                              type="time"
                              value={workEndTime}
                              onChange={(e) => setWorkEndTime(e.target.value)}
                              className="text-center"
                              style={{ fontFamily: 'Arial, sans-serif' }}
                            />
                          </div>
                        </div>

                        <Button onClick={saveSchedule} disabled={savingSchedule} className="w-full gap-2">
                          {savingSchedule ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              حفظ الجدول
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              سجلات الحضور
              <Badge variant="secondary" className="mr-2">{records.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد سجلات حضور لهذا التاريخ</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#3d9aa8] hover:bg-[#3d9aa8]">
                      <TableHead className="text-right text-white font-bold">الموظف</TableHead>
                      <TableHead className="text-right text-white font-bold">الوظيفة</TableHead>
                      <TableHead className="text-center text-white font-bold">جدول الدوام</TableHead>
                      <TableHead className="text-center text-white font-bold">تاريخ الحضور</TableHead>
                      <TableHead className="text-center text-white font-bold">وقت الحضور</TableHead>
                      <TableHead className="text-center text-white font-bold">وقت الانصراف</TableHead>
                      <TableHead className="text-center text-white font-bold">مدة العمل</TableHead>
                      <TableHead className="text-center text-white font-bold">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record, index) => {
                      const emp = employees.find(e => e.user_id === record.user_id);
                      return (
                        <TableRow key={record.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-accent/10 flex items-center justify-center">
                                {record.employee?.avatar_url ? (
                                  <img 
                                    src={record.employee.avatar_url} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-accent font-bold">
                                    {record.employee?.full_name?.charAt(0) || "؟"}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium text-foreground">
                                {record.employee?.full_name || "غير معروف"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.employee?.job_role || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm text-muted-foreground" style={{ fontFamily: 'Arial, sans-serif' }}>
                              {emp?.work_start_time?.substring(0, 5) || "08:00"} - {emp?.work_end_time?.substring(0, 5) || "16:00"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>
                              {(() => {
                                const [year, month, day] = record.date.split('-');
                                return `${day} / ${month} / ${year}`;
                              })()}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono">
                              {formatTime(record.check_in_at)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {record.check_out_at ? (
                              <Badge variant="outline" className="font-mono">
                                {formatTime(record.check_out_at)}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                                لم يسجل بعد
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-medium text-foreground">
                            {calculateWorkDuration(record.check_in_at, record.check_out_at)}
                          </TableCell>
                          <TableCell className="text-center">
                            {record.check_out_at ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                                مكتمل
                              </Badge>
                            ) : (
                              <Badge className="bg-sky-100 text-sky-700 border-sky-300">
                                جاري العمل
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
