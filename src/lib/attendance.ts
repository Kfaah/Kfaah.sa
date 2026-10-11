import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AttendanceRow = {
  employee_id: string;
  full_name: string;
  status: "present" | "absent" | "unrecorded";
  check_in_at: string | null;
  check_out_at: string | null;
};
export type AttendanceAction = "check_in" | "check_out" | "absent";
type AttendanceDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_employee_attendance: { Args: { _org: string; _day: string; _self_only: boolean }; Returns: AttendanceRow[] };
      record_employee_attendance: { Args: { _org: string; _action: AttendanceAction }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
// Same authenticated client/session, with the proposed RPC contract typed locally.
export const attendanceApi = supabase as unknown as SupabaseClient<AttendanceDatabase>;
export function riyadhDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}
export function attendanceTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)) : "—";
}
export function attendanceLabel(row: AttendanceRow): string {
  if (row.status === "absent") return "غائب";
  if (row.status === "unrecorded") return "لم يسجل";
  return row.check_out_at ? "حاضر — انصرف" : "حاضر";
}
