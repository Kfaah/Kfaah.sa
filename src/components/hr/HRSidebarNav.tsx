import { ClipboardList, UserCheck, CheckCircle2, FolderOpen, Plus } from "lucide-react";
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
    },
    {
      id: "pending-approvals" as HRSection,
      label: "موافقات معلقة",
      icon: UserCheck,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل موافقاتي",
      icon: CheckCircle2,
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const adminSections = [
    {
      id: "all-requests" as HRSection,
      label: "جميع الطلبات",
      icon: FolderOpen,
    },
    {
      id: "pending-approvals" as HRSection,
      label: "الموافقات المعلقة",
      icon: UserCheck,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل الموافقات",
      icon: CheckCircle2,
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const sections = hasAdminAccess ? adminSections : userSections;

  return (
    <aside className="w-full lg:w-64 flex-shrink-0">
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 sticky top-24">
        {/* Header */}
        <div className="mb-5 pb-4 border-b border-border">
          <h2 className="font-semibold text-foreground">الموارد البشرية</h2>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة الطلبات</p>
        </div>

        {/* زر طلب جديد */}
        <button 
          onClick={onNewRequest}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 px-4 text-sm font-medium hover:bg-primary/90 transition-colors mb-4"
        >
          <Plus className="w-4 h-4" />
          تقديم طلب جديد
        </button>

        {/* الأقسام */}
        <nav className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-right",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{section.label}</span>
                {section.badge && (
                  <span className={cn(
                    "min-w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-destructive text-destructive-foreground"
                  )}>
                    {section.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
