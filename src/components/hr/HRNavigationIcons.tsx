import { ClipboardList, UserCheck, CheckCircle2, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HRSection = "my-requests" | "pending-approvals" | "my-approvals-history" | "all-requests";

interface HRNavigationIconsProps {
  activeSection: HRSection;
  onSectionChange: (section: HRSection) => void;
  pendingApprovalsCount: number;
  approvalsHistoryCount: number;
}

export function HRNavigationIcons({
  activeSection,
  onSectionChange,
  pendingApprovalsCount,
  approvalsHistoryCount,
}: HRNavigationIconsProps) {
  const { user } = useAuth();

  // التحقق من صلاحيات المستخدم (مدير نظام أو مدير موارد بشرية)
  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map((r) => r.role) || [];
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRoles.includes("admin");
  const isHRManager = userRoles.includes("hr_manager");
  const hasAdminAccess = isAdmin || isHRManager;

  // الأقسام للمستخدمين العاديين
  const userSections = [
    {
      id: "my-requests" as HRSection,
      label: "طلباتي",
      icon: ClipboardList,
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50 border-violet-200 hover:border-violet-400",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "موافقات معلقة",
      icon: UserCheck,
      gradient: "from-orange-500 to-rose-500",
      bgLight: "bg-orange-50 border-orange-200 hover:border-orange-400",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل موافقاتي",
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  // الأقسام لمدير النظام / مدير الموارد البشرية (بدون سجل الموافقات)
  const adminSections = [
    {
      id: "all-requests" as HRSection,
      label: "الطلبات",
      icon: FolderOpen,
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50 border-violet-200 hover:border-violet-400",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "الموافقات المعلقة",
      icon: UserCheck,
      gradient: "from-orange-500 to-rose-500",
      bgLight: "bg-orange-50 border-orange-200 hover:border-orange-400",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
  ];

  const sections = hasAdminAccess ? adminSections : userSections;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full border transition-all duration-200",
              isActive
                ? `bg-gradient-to-r ${section.gradient} text-white border-transparent shadow-md`
                : `${section.bgLight} text-foreground`
            )}
          >
            {/* Badge */}
            {section.badge && (
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -left-1.5 h-5 min-w-5 p-0 flex items-center justify-center text-[10px] font-bold"
              >
                {section.badge}
              </Badge>
            )}
            
            {/* Icon */}
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center",
              isActive ? "bg-white/20" : section.iconBg
            )}>
              <Icon className={cn(
                "w-4 h-4",
                isActive ? "text-white" : section.iconColor
              )} />
            </div>
            
            {/* Label */}
            <span className={cn(
              "text-xs sm:text-sm font-medium whitespace-nowrap",
              isActive ? "text-white" : "text-foreground"
            )}>
              {section.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
