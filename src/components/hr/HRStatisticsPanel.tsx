import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  Users,
  Calendar,
  Clock,
  Loader2,
  Download,
  FileSpreadsheet,
  FileDown,
  Filter
} from "lucide-react";
import { format, subMonths, subWeeks, subQuarters, subYears, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { ar } from "date-fns/locale";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
};

type DateFilterType = "all" | "week" | "month" | "quarter" | "year";

const dateFilterOptions: { value: DateFilterType; label: string }[] = [
  { value: "all", label: "جميع الفترات" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
  { value: "quarter", label: "هذا الربع" },
  { value: "year", label: "هذا العام" },
];

export function HRStatisticsPanel() {
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");

  // جلب جميع الطلبات للإحصائيات
  const { data: allRequestsRaw = [], isLoading } = useQuery({
    queryKey: ["hr-statistics-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select(`
          *,
          hr_request_types (*),
          employees:user_id (full_name, job_role)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // جلب أنواع الطلبات
  const { data: requestTypes = [] } = useQuery({
    queryKey: ["hr-request-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_request_types")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // تصفية الطلبات حسب الفترة الزمنية
  const allRequests = useMemo(() => {
    if (dateFilter === "all") return allRequestsRaw;

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dateFilter) {
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 0 });
        endDate = endOfWeek(now, { weekStartsOn: 0 });
        break;
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "quarter":
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case "year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      default:
        return allRequestsRaw;
    }

    return allRequestsRaw.filter((r: any) => {
      const requestDate = new Date(r.created_at);
      return isWithinInterval(requestDate, { start: startDate, end: endDate });
    });
  }, [allRequestsRaw, dateFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // حساب الإحصائيات العامة
  const totalRequests = allRequests.length;
  const pendingRequests = allRequests.filter((r: any) => r.status === "pending").length;
  const approvedRequests = allRequests.filter((r: any) => r.status === "approved").length;
  const rejectedRequests = allRequests.filter((r: any) => r.status === "rejected").length;
  const totalDaysUsed = allRequests
    .filter((r: any) => r.status === "approved" && r.days_count)
    .reduce((sum: number, r: any) => sum + (r.days_count || 0), 0);

  // إحصائيات حسب نوع الطلب
  const requestsByType = requestTypes.map((type: any) => {
    const typeRequests = allRequests.filter((r: any) => r.request_type_id === type.id);
    return {
      name: type.name_ar,
      total: typeRequests.length,
      approved: typeRequests.filter((r: any) => r.status === "approved").length,
      pending: typeRequests.filter((r: any) => r.status === "pending").length,
      rejected: typeRequests.filter((r: any) => r.status === "rejected").length,
    };
  }).filter(t => t.total > 0);

  // إحصائيات حسب الموظف
  const employeeStats = allRequests.reduce((acc: any, r: any) => {
    const empName = r.employees?.full_name || "غير معروف";
    if (!acc[empName]) {
      acc[empName] = { name: empName, total: 0, approved: 0, days: 0 };
    }
    acc[empName].total++;
    if (r.status === "approved") {
      acc[empName].approved++;
      acc[empName].days += r.days_count || 0;
    }
    return acc;
  }, {});
  
  const topEmployees = Object.values(employeeStats)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 5) as any[];

  // إحصائيات شهرية (آخر 6 أشهر)
  const monthlyStats = [];
  for (let i = 5; i >= 0; i--) {
    const month = subMonths(new Date(), i);
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    
    const monthRequests = allRequests.filter((r: any) => {
      const date = new Date(r.created_at);
      return date >= start && date <= end;
    });
    
    monthlyStats.push({
      month: format(month, "MMM", { locale: ar }),
      total: monthRequests.length,
      approved: monthRequests.filter((r: any) => r.status === "approved").length,
      rejected: monthRequests.filter((r: any) => r.status === "rejected").length,
    });
  }

  // بيانات الرسم الدائري للحالات
  const statusPieData = [
    { name: "موافق عليها", value: approvedRequests, color: "#22c55e" },
    { name: "قيد المراجعة", value: pendingRequests, color: "#f59e0b" },
    { name: "مرفوضة", value: rejectedRequests, color: "#ef4444" },
  ].filter(d => d.value > 0);

  // تصدير إلى Excel
  const exportToExcel = () => {
    try {
      // تحضير بيانات الطلبات
      const requestsData = allRequests.map((r: any) => ({
        "رقم الطلب": r.request_number,
        "الموظف": r.employees?.full_name || "غير معروف",
        "نوع الطلب": r.hr_request_types?.name_ar || "",
        "الحالة": statusLabels[r.status] || r.status,
        "تاريخ البداية": r.start_date ? format(new Date(r.start_date), "yyyy-MM-dd") : "",
        "تاريخ النهاية": r.end_date ? format(new Date(r.end_date), "yyyy-MM-dd") : "",
        "عدد الأيام": r.days_count || "",
        "السبب": r.reason || "",
        "تاريخ التقديم": format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
      }));

      // تحضير بيانات الإحصائيات
      const statsData = [
        { "البيان": "إجمالي الطلبات", "القيمة": totalRequests },
        { "البيان": "قيد المراجعة", "القيمة": pendingRequests },
        { "البيان": "موافق عليها", "القيمة": approvedRequests },
        { "البيان": "مرفوضة", "القيمة": rejectedRequests },
        { "البيان": "إجمالي أيام الإجازات", "القيمة": totalDaysUsed },
      ];

      // إنشاء workbook
      const wb = XLSX.utils.book_new();
      
      // ورقة الطلبات
      const wsRequests = XLSX.utils.json_to_sheet(requestsData);
      XLSX.utils.book_append_sheet(wb, wsRequests, "الطلبات");
      
      // ورقة الإحصائيات
      const wsStats = XLSX.utils.json_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, wsStats, "الإحصائيات");
      
      // ورقة الطلبات حسب النوع
      const typeData = requestsByType.map(t => ({
        "نوع الطلب": t.name,
        "الإجمالي": t.total,
        "موافق عليها": t.approved,
        "قيد المراجعة": t.pending,
        "مرفوضة": t.rejected,
      }));
      const wsTypes = XLSX.utils.json_to_sheet(typeData);
      XLSX.utils.book_append_sheet(wb, wsTypes, "حسب النوع");

      // تنزيل الملف
      XLSX.writeFile(wb, `تقرير_الموارد_البشرية_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("تم تصدير التقرير إلى Excel بنجاح");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("حدث خطأ أثناء تصدير التقرير");
    }
  };

  // تصدير إلى PDF
  const exportToPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // إضافة خط يدعم العربية (بسيط بدون خطوط مخصصة)
      doc.setFont("helvetica");
      
      // العنوان
      doc.setFontSize(18);
      doc.text("HR Requests Report - تقرير طلبات الموارد البشرية", 148, 15, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Date: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 148, 22, { align: "center" });

      // إحصائيات عامة
      doc.setFontSize(12);
      doc.text("Summary Statistics - الإحصائيات العامة", 14, 35);
      
      autoTable(doc, {
        startY: 40,
        head: [["Description", "Value"]],
        body: [
          ["Total Requests - إجمالي الطلبات", totalRequests.toString()],
          ["Pending - قيد المراجعة", pendingRequests.toString()],
          ["Approved - موافق عليها", approvedRequests.toString()],
          ["Rejected - مرفوضة", rejectedRequests.toString()],
          ["Total Leave Days - أيام الإجازات", totalDaysUsed.toString()],
        ],
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
        tableWidth: 80,
      });

      // جدول الطلبات حسب النوع
      const typeTableY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("Requests by Type - الطلبات حسب النوع", 14, typeTableY);
      
      autoTable(doc, {
        startY: typeTableY + 5,
        head: [["Type", "Total", "Approved", "Pending", "Rejected"]],
        body: requestsByType.map(t => [t.name, t.total, t.approved, t.pending, t.rejected]),
        theme: "grid",
        headStyles: { fillColor: [34, 197, 94] },
        margin: { left: 14, right: 14 },
      });

      // جدول الطلبات
      const requestsTableY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("All Requests - جميع الطلبات", 14, requestsTableY);
      
      autoTable(doc, {
        startY: requestsTableY + 5,
        head: [["Request #", "Employee", "Type", "Status", "Start Date", "Days"]],
        body: allRequests.slice(0, 50).map((r: any) => [
          r.request_number,
          r.employees?.full_name || "-",
          r.hr_request_types?.name_ar || "-",
          statusLabels[r.status] || r.status,
          r.start_date ? format(new Date(r.start_date), "yyyy-MM-dd") : "-",
          r.days_count || "-",
        ]),
        theme: "grid",
        headStyles: { fillColor: [139, 92, 246] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 },
      });

      // حفظ الملف
      doc.save(`HR_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("تم تصدير التقرير إلى PDF بنجاح");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("حدث خطأ أثناء تصدير التقرير");
    }
  };

  return (
    <div className="space-y-6">
      {/* شريط الأدوات - فلتر التاريخ وأزرار التصدير */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        {/* فلتر التاريخ */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">الفترة الزمنية:</span>
          </div>
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilterType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* أزرار التصدير */}
        <div className="flex items-center gap-3">
          <Button
            onClick={exportToExcel}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel
          </Button>
          <Button
            onClick={exportToPDF}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <FileDown className="w-4 h-4" />
            تصدير PDF
          </Button>
        </div>
      </div>

      {/* البطاقات الإحصائية الرئيسية */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">إجمالي الطلبات</p>
                <p className="text-2xl font-bold text-blue-700">{totalRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">قيد المراجعة</p>
                <p className="text-2xl font-bold text-amber-700">{pendingRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">موافق عليها</p>
                <p className="text-2xl font-bold text-green-700">{approvedRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-red-600">مرفوضة</p>
                <p className="text-2xl font-bold text-red-700">{rejectedRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-600">أيام الإجازات</p>
                <p className="text-2xl font-bold text-purple-700">{totalDaysUsed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* رسم بياني شهري */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-accent" />
              الطلبات خلال الأشهر الستة الماضية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'right'
                    }} 
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    name="الإجمالي"
                    stroke="#0ea5e9" 
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="approved" 
                    name="موافق عليها"
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ fill: '#22c55e' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="rejected" 
                    name="مرفوضة"
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* رسم دائري للحالات */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-accent" />
              توزيع حالات الطلبات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* إحصائيات حسب النوع والموظف */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* إحصائيات حسب نوع الطلب */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-accent" />
              الطلبات حسب النوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {requestsByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={requestsByType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11 }} 
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        textAlign: 'right'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="approved" name="موافق عليها" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="pending" name="قيد المراجعة" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="rejected" name="مرفوضة" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* أكثر الموظفين طلباً */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-accent" />
              أكثر الموظفين طلباً
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topEmployees.length > 0 ? (
              <div className="space-y-4">
                {topEmployees.map((emp: any, index: number) => (
                  <div key={index} className="flex items-center gap-4">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">{emp.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {emp.total} طلب
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all"
                          style={{ 
                            width: `${(emp.approved / emp.total) * 100}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <span>موافق عليها: {emp.approved}</span>
                        <span>إجمالي الأيام: {emp.days}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                لا توجد بيانات
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
