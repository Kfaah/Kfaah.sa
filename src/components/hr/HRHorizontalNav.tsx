import { ClipboardList, UserCheck, CheckCircle2, FolderOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";

export type HRSection = "my-requests" | "pending-approvals" | "my-approvals-history" | "all-requests";

interface HRHorizontalNavProps {
  activeSection: HRSection;
  onSectionChange: (section: HRSection) => void;
  pendingApprovalsCount: number;
  approvalsHistoryCount: number;
  onNewRequest: () => void;
}

export function HRHorizontalNav({
  activeSection,
  onSectionChange,
  pendingApprovalsCount,
  approvalsHistoryCount,
  onNewRequest,
}: HRHorizontalNavProps) {
  const { user } = useAuth();

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

  const userSections = [
    {
      id: "my-requests" as HRSection,
      label: "طلباتي",
      icon: ClipboardList,
      color: "from-violet-500 to-purple-500",
      bgLight: "bg-violet-50 dark:bg-violet-950/30",
      iconColor: "text-violet-600 dark:text-violet-400",
      borderColor: "border-violet-200 dark:border-violet-800",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "موافقات معلقة",
      icon: UserCheck,
      color: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-200 dark:border-amber-800",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل موافقاتي",
      icon: CheckCircle2,
      color: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const adminSections = [
    {
      id: "all-requests" as HRSection,
      label: "جميع الطلبات",
      icon: FolderOpen,
      color: "from-violet-500 to-purple-500",
      bgLight: "bg-violet-50 dark:bg-violet-950/30",
      iconColor: "text-violet-600 dark:text-violet-400",
      borderColor: "border-violet-200 dark:border-violet-800",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "الموافقات المعلقة",
      icon: UserCheck,
      color: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-50 dark:bg-amber-950/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-200 dark:border-amber-800",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل الموافقات",
      icon: CheckCircle2,
      color: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const sections = hasAdminAccess ? adminSections : userSections;

  return (
    <Card className="p-4 border shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* زر طلب جديد */}
        <button 
          onClick={onNewRequest}
          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all duration-200 min-w-[100px]"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs font-medium text-primary">طلب جديد</span>
        </button>

        {/* الأقسام */}
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 min-w-[100px]",
                isActive
                  ? `${section.bgLight} ${section.borderColor} shadow-sm`
                  : "border-transparent bg-muted/30 hover:bg-muted/50"
              )}
            >
              {/* Badge */}
              {section.badge && (
                <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold bg-destructive text-destructive-foreground shadow-sm">
                  {section.badge}
                </span>
              )}
              
              {/* Icon */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm transition-all",
                isActive 
                  ? `bg-gradient-to-br ${section.color}` 
                  : "bg-muted"
              )}>
                <Icon className={cn(
                  "w-6 h-6 transition-colors",
                  isActive ? "text-white" : "text-muted-foreground"
                )} />
              </div>
              
              {/* Label */}
              <span className={cn(
                "text-xs font-medium transition-colors text-center",
                isActive ? section.iconColor : "text-muted-foreground"
              )}>
                {section.label}
              </span>

              {/* Active indicator */}
              {isActive && (
                <div className={cn(
                  "absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r",
                  section.color
                )} />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
