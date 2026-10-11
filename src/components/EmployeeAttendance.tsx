import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useUser } from "@/contexts/UserContext";
import { useIsViewer } from "@/hooks/useIsViewer";
import { getOrgPrivilegeFlags } from "@/lib/orgAuthorization";
import { attendanceApi, attendanceLabel, attendanceTime, riyadhDay, type AttendanceAction } from "@/lib/attendance";

export function EmployeeAttendance({ management = false, organizationId }: { management?: boolean; organizationId?: string }) {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const { previewAsEmployee, previewingEmployee } = useUser();
  const { isViewer, loading: viewerLoading } = useIsViewer();
  const client = useQueryClient();
  const [today, setToday] = useState(riyadhDay);
  const [selectedDay, setSelectedDay] = useState(riyadhDay);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(riyadhDay()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const org = organizationId ?? currentOrg?.id;
  const preview = previewAsEmployee || !!previewingEmployee;
  const day = management ? selectedDay : today;
  const privileges = useQuery({
    queryKey: ["attendance-privileges", user?.id, org],
    queryFn: () => getOrgPrivilegeFlags(user?.id, org),
    enabled: management && !!user && !!org && !preview,
  });
  const flags = privileges.data;
  const manager = !!flags && (flags.isSuperAdmin || flags.isOrgAdmin || flags.isHrManager);
  const records = useQuery({
    queryKey: ["employee-attendance", user?.id, org, day, management],
    queryFn: async () => {
      const { data, error } = await attendanceApi.rpc("get_employee_attendance", { _org: org!, _day: day, _self_only: !management });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && !!org && !preview && (!management || manager),
    refetchInterval: 60000,
  });
  const mutation = useMutation({
    mutationFn: async ({ action, organization }: { action: AttendanceAction; organization: string }) => {
      const { error } = await attendanceApi.rpc("record_employee_attendance", { _org: organization, _action: action });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم حفظ السجل");
      await client.invalidateQueries({ queryKey: ["employee-attendance"] });
    },
    onError: () => {
      toast.error("تعذر حفظ السجل. تحقق من الصلاحية وحالة اليوم، ثم حدّث السجل قبل المحاولة مجددًا.");
      void client.invalidateQueries({ queryKey: ["employee-attendance"] });
    },
  });
  if (!org || !user || preview || (management && !manager)) return null;
  const rows = records.data ?? [];
  const own = rows[0];
  const disabled = mutation.isPending || records.isFetching || records.isError || viewerLoading || isViewer;
  const record = (action: AttendanceAction) => {
    if (disabled || !own) return;
    if (action === "absent" && !window.confirm("تأكيد تسجيل الغياب اليوم؟ لا يمكن تغييره من هذه الشاشة بعد الحفظ.")) return;
    mutation.mutate({ action, organization: org });
  };
  return (
    <Card className="mb-6" dir="rtl">
      <CardHeader><CardTitle>{management ? "متابعة حضور وغياب الموظفين" : "الحضور والغياب والانصراف"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {management ? <label className="flex items-center gap-2">التاريخ
            <Input type="date" value={selectedDay} max={today} onChange={(e) => {
              if (e.target.value && e.target.value <= today) setSelectedDay(e.target.value);
            }} className="w-auto" />
          </label> : <span>اليوم: {today}</span>}
          <span className="text-sm text-muted-foreground">بتوقيت الرياض</span>
          <Button variant="outline" disabled={records.isFetching} onClick={() => void records.refetch()}>تحديث</Button>
        </div>
        {records.isPending ? <p role="status">جارٍ تحميل السجل…</p> : records.isError ?
          <p role="alert" className="text-destructive">تعذر تحميل الحضور. قد لا تكون خدمة الحضور مفعّلة أو قد لا تتوفر صلاحية القراءة. لا يمكن التسجيل حتى يُحل الخطأ.</p> : management ? <>
            <p className="text-sm">حاضر: {rows.filter(r => r.status === "present").length} · غائب: {rows.filter(r => r.status === "absent").length} · لم يسجل: {rows.filter(r => r.status === "unrecorded").length}</p>
            <div className="overflow-x-auto"><table className="w-full text-right text-sm">
              <thead><tr><th className="p-2">الموظف</th><th className="p-2">الحالة</th><th className="p-2">الحضور</th><th className="p-2">الانصراف</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.employee_id} className="border-t">
                <td className="p-2">{row.full_name}</td><td className="p-2">{attendanceLabel(row)}</td>
                <td className="p-2">{attendanceTime(row.check_in_at)}</td><td className="p-2">{attendanceTime(row.check_out_at)}</td>
              </tr>)}</tbody>
            </table></div>
            {!rows.length && <p>لا يوجد موظفون متاحون لهذا النطاق.</p>}
            <p className="text-sm text-muted-foreground">«لم يسجل» لا يعني غيابًا؛ لا تُحتسب الإجازات أو أيام العطلة تلقائيًا.</p>
          </> : own ? <>
            <p>الحالة: <strong>{attendanceLabel(own)}</strong></p>
            <p>الحضور: {attendanceTime(own.check_in_at)} · الانصراف: {attendanceTime(own.check_out_at)}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={disabled || own.status !== "unrecorded"} onClick={() => record("check_in")}>تسجيل الحضور</Button>
              <Button variant="outline" disabled={disabled || own.status !== "unrecorded"} onClick={() => record("absent")}>تسجيل الغياب</Button>
              <Button variant="secondary" disabled={disabled || own.status !== "present" || !!own.check_out_at} onClick={() => record("check_out")}>تسجيل الانصراف</Button>
            </div>
            {isViewer && <p className="text-sm text-muted-foreground">الحساب للقراءة فقط.</p>}
          </> : <p>لا يوجد ملف موظف مرتبط بحسابك في هذه الجمعية.</p>}
      </CardContent>
    </Card>
  );
}
