import { ClipboardList, UserCheck, CheckCircle2, FolderOpen, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HRSection = "my-requests" | "pending-approvals" | "my-approvals-history" | "all-requests";

interface HRSidebarNavProps {
  activeSection: HRSection;
  onSectionChange: (section: HRSection) => void;
  pendingApprovalsCount: number;
  approvalsHistoryCount: number;
  onNewRequest: () => void;
}

export function HRSidebarNav({
  activeSection,
  onSectionChange,
  pendingApprovalsCount,
  approvalsHistoryCount,
  onNewRequest,
}: HRSidebarNavProps) {
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
      bgActive: "bg-gradient-to-r from-violet-500 to-purple-600",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "موافقات معلقة",
      icon: UserCheck,
      gradient: "from-orange-500 to-rose-500",
      bgLight: "bg-orange-50 border-orange-200 hover:border-orange-400",
      bgActive: "bg-gradient-to-r from-orange-500 to-rose-500",
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
      bgActive: "bg-gradient-to-r from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  // الأقسام لمدير النظام / مدير الموارد البشرية
  const adminSections = [
    {
      id: "all-requests" as HRSection,
      label: "الطلبات",
      icon: FolderOpen,
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50 border-violet-200 hover:border-violet-400",
      bgActive: "bg-gradient-to-r from-violet-500 to-purple-600",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "الموافقات المعلقة",
      icon: UserCheck,
      gradient: "from-orange-500 to-rose-500",
      bgLight: "bg-orange-50 border-orange-200 hover:border-orange-400",
      bgActive: "bg-gradient-to-r from-orange-500 to-rose-500",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل الموافقات",
      icon: CheckCircle2,
      gradient: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
      bgActive: "bg-gradient-to-r from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const sections = hasAdminAccess ? adminSections : userSections;

  return (
    <div className="w-full lg:w-72 flex-shrink-0">
      <div className="bg-card rounded-2xl border shadow-sm p-4 space-y-3 sticky top-24">
        {/* زر طلب جديد */}
        <Button 
          onClick={onNewRequest}
          className="w-full bg-gradient-to-r from-accent to-teal-500 hover:from-accent/90 hover:to-teal-500/90 text-white gap-2 h-12 text-base font-medium rounded-xl shadow-md"
        >
          <Plus className="w-5 h-5" />
          طلب جديد
        </Button>

        {/* الفاصل */}
        <div className="border-t border-border/50 my-2" />

        {/* الأقسام */}
        <nav className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "relative w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 text-right",
                  isActive
                    ? `${section.bgActive} text-white border-transparent shadow-lg`
                    : `${section.bgLight} text-foreground hover:shadow-md`
                )}
              >
                {/* Badge */}
                {section.badge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1.5 left-2 h-5 min-w-5 p-0 flex items-center justify-center text-[10px] font-bold animate-pulse"
                  >
                    {section.badge}
                  </Badge>
                )}
                
                {/* Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  isActive ? "bg-white/20" : section.iconBg
                )}>
                  <Icon className={cn(
                    "w-5 h-5",
                    isActive ? "text-white" : section.iconColor
                  )} />
                </div>
                
                {/* Label */}
                <span className={cn(
                  "font-medium flex-1",
                  isActive ? "text-white" : "text-foreground"
                )}>
                  {section.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
