import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  UserCheck,
  Users,
  Briefcase,
  Calculator,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface WorkflowStage {
  id: string;
  name: string;
  role: string;
  status: "pending" | "approved" | "rejected" | "waiting";
  approverName?: string;
  approverAvatar?: string;
  approvedAt?: string;
  signatureUrl?: string;
}

interface WorkflowTimelineProps {
  request: any;
  compact?: boolean;
  showSignatures?: boolean;
}

const stageConfig = {
  applicant: {
    icon: User,
    label: "مقدم الطلب",
    color: "bg-slate-500",
    lightColor: "bg-slate-100",
    textColor: "text-slate-700",
  },
  substitute: {
    icon: UserCheck,
    label: "الموظف البديل",
    color: "bg-amber-500",
    lightColor: "bg-amber-100",
    textColor: "text-amber-700",
  },
  direct_manager: {
    icon: Users,
    label: "المدير المباشر",
    color: "bg-blue-500",
    lightColor: "bg-blue-100",
    textColor: "text-blue-700",
  },
  hr_manager: {
    icon: Briefcase,
    label: "مدير الموارد البشرية",
    color: "bg-purple-500",
    lightColor: "bg-purple-100",
    textColor: "text-purple-700",
  },
  finance_manager: {
    icon: Calculator,
    label: "المدير المالي",
    color: "bg-green-500",
    lightColor: "bg-green-100",
    textColor: "text-green-700",
  },
};

const statusConfig = {
  approved: {
    icon: CheckCircle2,
    label: "تمت الموافقة",
    color: "text-green-600",
    bgColor: "bg-green-100",
    borderColor: "border-green-500",
  },
  pending: {
    icon: Clock,
    label: "بانتظار الموافقة",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-500",
  },
  waiting: {
    icon: Clock,
    label: "في الانتظار",
    color: "text-gray-400",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
  },
  rejected: {
    icon: XCircle,
    label: "مرفوض",
    color: "text-red-600",
    bgColor: "bg-red-100",
    borderColor: "border-red-500",
  },
};

export function WorkflowTimeline({
  request,
  compact = false,
  showSignatures = false,
}: WorkflowTimelineProps) {
  // جلب بيانات الموظفين المعنيين + محاولة استنتاج HR/التنفيذي عند غيابها في الطلب (للطلبات القديمة)
  const { data: workflowContext } = useQuery({
    queryKey: ["workflow-employees", request?.id],
    queryFn: async () => {
      if (!request) {
        return {
          employees: [],
          hrManagerUserId: null as string | null,
          executiveUserId: null as string | null,
        };
      }

      let hrManagerUserId: string | null = request.hr_manager_id ?? null;
      let executiveUserId: string | null = (request.finance_manager_id || request.executive_manager_id) ?? null;

      // HR manager: إن لم يكن محفوظاً داخل الطلب، نجلبه من الدالة العامة
      if (!hrManagerUserId) {
        const { data: hrId } = await supabase.rpc("get_hr_manager_id");
        hrManagerUserId = hrId ?? null;
      }

      // Executive manager: إن لم يكن محفوظاً داخل الطلب، نحاول جلبه من هيكل الموظف
      // (employees.executive_manager_id => employees.id ثم نحول إلى employees.user_id)
      if (!executiveUserId && request.user_id) {
        const { data: emp } = await supabase
          .from("employees")
          .select("executive_manager_id")
          .eq("user_id", request.user_id)
          .maybeSingle();

        if (emp?.executive_manager_id) {
          const { data: execEmp } = await supabase
            .from("employees")
            .select("user_id")
            .eq("id", emp.executive_manager_id)
            .maybeSingle();

          executiveUserId = execEmp?.user_id ?? null;
        }
      }

      const userIds = [
        request.user_id,
        request.substitute_employee_id,
        request.direct_manager_id,
        request.hr_manager_id,
        request.finance_manager_id,
        request.executive_manager_id,
        hrManagerUserId,
        executiveUserId,
      ].filter(Boolean) as string[];

      const uniqueUserIds = Array.from(new Set(userIds));
      if (uniqueUserIds.length === 0) {
        return { employees: [], hrManagerUserId, executiveUserId };
      }

      const { data, error } = await supabase
        .from("employees")
        .select("user_id, full_name, avatar_url, signature_url, job_role")
        .in("user_id", uniqueUserIds);

      if (error) throw error;
      return { employees: data || [], hrManagerUserId, executiveUserId };
    },
    enabled: !!request,
  });

  const employees = workflowContext?.employees ?? [];

  if (!request) return null;

  const resolvedHrManagerId = workflowContext?.hrManagerUserId ?? request.hr_manager_id ?? null;
  const resolvedExecutiveId =
    workflowContext?.executiveUserId ?? (request.finance_manager_id || request.executive_manager_id) ?? null;

  const getEmployee = (userId: string | null) => {
    if (!userId) return null;
    return employees.find((e) => e.user_id === userId);
  };

  // بناء مراحل سير العمل
  const buildStages = (): WorkflowStage[] => {
    const stages: WorkflowStage[] = [];
    const isRejected = request.status === "rejected";

    // 1. مقدم الطلب (دائماً معتمد)
    const applicant = getEmployee(request.user_id);
    stages.push({
      id: "applicant",
      name: "applicant",
      role: stageConfig.applicant.label,
      status: "approved",
      approverName: applicant?.full_name || "---",
      approverAvatar: applicant?.avatar_url,
      approvedAt: request.created_at,
      signatureUrl: applicant?.signature_url,
    });

    // 2. الموظف البديل (إذا تم تعيينه)
    if (request.substitute_employee_id) {
      const substitute = getEmployee(request.substitute_employee_id);
      let status: WorkflowStage["status"] = "waiting";
      
      if (isRejected && !request.substitute_approved) {
        status = "rejected";
      } else if (request.substitute_approved) {
        status = "approved";
      } else if (stages[stages.length - 1]?.status === "approved") {
        status = "pending";
      }

      stages.push({
        id: "substitute",
        name: "substitute",
        role: stageConfig.substitute.label,
        status,
        approverName: substitute?.full_name || "---",
        approverAvatar: substitute?.avatar_url,
        approvedAt: request.substitute_approved_at,
        signatureUrl: substitute?.signature_url,
      });
    }

    // 3. المدير المباشر (إذا تم تعيينه)
    if (request.direct_manager_id) {
      const manager = getEmployee(request.direct_manager_id);
      let status: WorkflowStage["status"] = "waiting";

      const prevStage = stages[stages.length - 1];
      if (isRejected && !request.manager_approved && prevStage?.status === "approved") {
        status = "rejected";
      } else if (request.manager_approved) {
        status = "approved";
      } else if (prevStage?.status === "approved") {
        status = "pending";
      }

      stages.push({
        id: "direct_manager",
        name: "direct_manager",
        role: stageConfig.direct_manager.label,
        status,
        approverName: manager?.full_name || "---",
        approverAvatar: manager?.avatar_url,
        approvedAt: request.manager_approved_at,
        signatureUrl: manager?.signature_url,
      });
    }

    // 4. مدير الموارد البشرية (إذا تم تعيينه)
    if (request.hr_manager_id) {
      const hrManager = getEmployee(request.hr_manager_id);
      let status: WorkflowStage["status"] = "waiting";

      const prevStage = stages[stages.length - 1];
      if (isRejected && !request.hr_manager_approved && prevStage?.status === "approved") {
        status = "rejected";
      } else if (request.hr_manager_approved) {
        status = "approved";
      } else if (prevStage?.status === "approved") {
        status = "pending";
      }

      stages.push({
        id: "hr_manager",
        name: "hr_manager",
        role: stageConfig.hr_manager.label,
        status,
        approverName: hrManager?.full_name || "---",
        approverAvatar: hrManager?.avatar_url,
        approvedAt: request.hr_manager_approved_at,
        signatureUrl: hrManager?.signature_url,
      });
    }

    // 5. المدير المالي/التنفيذي (إذا تم تعيينه)
    const financeManagerId = request.finance_manager_id || request.executive_manager_id;
    if (financeManagerId) {
      const financeManager = getEmployee(financeManagerId);
      let status: WorkflowStage["status"] = "waiting";

      const prevStage = stages[stages.length - 1];
      const isApproved = request.finance_manager_approved || request.executive_manager_approved;
      const approvedAt = request.finance_manager_approved_at || request.executive_manager_approved_at;

      if (isRejected && !isApproved && prevStage?.status === "approved") {
        status = "rejected";
      } else if (isApproved) {
        status = "approved";
      } else if (prevStage?.status === "approved") {
        status = "pending";
      }

      stages.push({
        id: "finance_manager",
        name: "finance_manager",
        role: request.finance_manager_id ? stageConfig.finance_manager.label : "المدير التنفيذي",
        status,
        approverName: financeManager?.full_name || "---",
        approverAvatar: financeManager?.avatar_url,
        approvedAt: approvedAt,
        signatureUrl: financeManager?.signature_url,
      });
    }

    return stages;
  };

  const stages = buildStages();

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap" dir="rtl">
        {stages.map((stage, index) => {
          const config = stageConfig[stage.name as keyof typeof stageConfig] || stageConfig.applicant;
          const StatusIcon = statusConfig[stage.status].icon;
          
          return (
            <div key={stage.id} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                  statusConfig[stage.status].bgColor,
                  statusConfig[stage.status].color
                )}
                title={`${stage.role}: ${stage.approverName} - ${statusConfig[stage.status].label}`}
              >
                <StatusIcon className="w-3 h-3" />
                <span className="hidden sm:inline">{stage.role}</span>
              </div>
              {index < stages.length - 1 && (
                <ArrowLeft className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <h4 className="font-semibold text-foreground flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        مسار سير المعاملة
      </h4>

      <div className="relative">
        {/* خط التوصيل */}
        <div className="absolute right-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/10" />

        <div className="space-y-4">
          {stages.map((stage, index) => {
            const config = stageConfig[stage.name as keyof typeof stageConfig] || stageConfig.applicant;
            const StageIcon = config.icon;
            const StatusIcon = statusConfig[stage.status].icon;

            return (
              <div
                key={stage.id}
                className={cn(
                  "relative flex items-start gap-4 p-4 rounded-xl border transition-all",
                  stage.status === "approved" && "bg-green-50/50 border-green-200",
                  stage.status === "pending" && "bg-amber-50/50 border-amber-200 animate-pulse",
                  stage.status === "waiting" && "bg-gray-50/50 border-gray-200 opacity-60",
                  stage.status === "rejected" && "bg-red-50/50 border-red-200"
                )}
              >
                {/* أيقونة المرحلة */}
                <div
                  className={cn(
                    "relative z-10 w-12 h-12 rounded-xl flex items-center justify-center",
                    config.color
                  )}
                >
                  <StageIcon className="w-6 h-6 text-white" />
                  
                  {/* مؤشر الحالة */}
                  <div
                    className={cn(
                      "absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white",
                      statusConfig[stage.status].bgColor
                    )}
                  >
                    <StatusIcon className={cn("w-3 h-3", statusConfig[stage.status].color)} />
                  </div>
                </div>

                {/* محتوى المرحلة */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h5 className={cn("font-bold", config.textColor)}>{stage.role}</h5>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        statusConfig[stage.status].bgColor,
                        statusConfig[stage.status].color
                      )}
                    >
                      {statusConfig[stage.status].label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {stage.approverAvatar ? (
                      <img
                        src={stage.approverAvatar}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", config.lightColor)}>
                        <User className={cn("w-3 h-3", config.textColor)} />
                      </div>
                    )}
                    <span className="font-medium text-foreground">{stage.approverName}</span>
                  </div>

                  {stage.approvedAt && stage.status === "approved" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(stage.approvedAt), "d MMMM yyyy - h:mm a", { locale: ar })}
                    </p>
                  )}

                  {/* عرض التوقيع */}
                  {showSignatures && stage.signatureUrl && stage.status === "approved" && (
                    <div className="mt-2 p-2 bg-white rounded border">
                      <img
                        src={stage.signatureUrl}
                        alt="التوقيع"
                        className="h-8 object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ملخص الحالة */}
      <div className={cn(
        "p-3 rounded-lg text-center text-sm font-medium",
        request.status === "approved" && "bg-green-100 text-green-700",
        request.status === "pending" && "bg-amber-100 text-amber-700",
        request.status === "rejected" && "bg-red-100 text-red-700"
      )}>
        {request.status === "approved" && "✅ تمت الموافقة على الطلب بنجاح"}
        {request.status === "pending" && `⏳ الطلب في المرحلة ${stages.filter(s => s.status === "approved").length} من ${stages.length}`}
        {request.status === "rejected" && `❌ تم رفض الطلب - السبب: ${request.rejection_reason || "غير محدد"}`}
      </div>
    </div>
  );
}
