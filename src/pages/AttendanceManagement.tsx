import { useState, useEffect } from "react";
import { Clock, Users, Calendar, TrendingUp, AlertCircle, CheckCircle, XCircle, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

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
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    averageHoursThisMonth: 0,
    lateArrivalsThisMonth: 0
  });

  useEffect(() => {
    fetchAttendanceRecords();
    fetchStats();
  }, [dateFilter]);

  const fetchAttendanceRecords = async () => {
    setLoading(true);
    try {
      // Fetch attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", dateFilter)
        .order("check_in_at", { ascending: false });
      
      if (attendanceError) throw attendanceError;

      // Fetch employees separately
      const { data: employees } = await supabase
        .from("employees")
        .select("user_id, full_name, job_role, avatar_url");

      const employeeMap = new Map(employees?.map(e => [e.user_id, e]) || []);
      
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
      const today = new Date().toISOString().split('T')[0];
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

  const calculateWorkDuration = (checkIn: string, checkOut: string | null): string => {
    if (!checkOut) return "جاري العمل";
    
    const minutes = differenceInMinutes(new Date(checkOut), new Date(checkIn));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    return `${hours} ساعة ${mins} دقيقة`;
  };

  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const employeeName = record.employee?.full_name || "";
    return employeeName.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="البحث عن موظف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-48"
                />
                <Button
                  variant="outline"
                  onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
                >
                  اليوم
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent" />
              سجلات الحضور
              <Badge variant="secondary" className="mr-2">{filteredRecords.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد سجلات حضور لهذا التاريخ</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">الوظيفة</TableHead>
                      <TableHead className="text-right">وقت الحضور</TableHead>
                      <TableHead className="text-right">وقت الانصراف</TableHead>
                      <TableHead className="text-right">مدة العمل</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
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
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {formatTime(record.check_in_at)}
                          </Badge>
                        </TableCell>
                        <TableCell>
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
                        <TableCell className="font-medium text-foreground">
                          {calculateWorkDuration(record.check_in_at, record.check_out_at)}
                        </TableCell>
                        <TableCell>
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
