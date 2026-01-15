import { ClipboardList, UserCheck, CheckCircle2, FolderOpen, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

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
      color: "from-violet-500 to-purple-600",
      lightBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "موافقات معلقة",
      icon: UserCheck,
      color: "from-amber-500 to-orange-500",
      lightBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل موافقاتي",
      icon: CheckCircle2,
      color: "from-emerald-500 to-teal-500",
      lightBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const adminSections = [
    {
      id: "all-requests" as HRSection,
      label: "الطلبات",
      icon: FolderOpen,
      color: "from-violet-500 to-purple-600",
      lightBg: "bg-violet-500/10",
      iconColor: "text-violet-500",
    },
    {
      id: "pending-approvals" as HRSection,
      label: "الموافقات المعلقة",
      icon: UserCheck,
      color: "from-amber-500 to-orange-500",
      lightBg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل الموافقات",
      icon: CheckCircle2,
      color: "from-emerald-500 to-teal-500",
      lightBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
    },
  ];

  const sections = hasAdminAccess ? adminSections : userSections;

  return (
    <div className="w-full lg:w-80 flex-shrink-0">
      <div className="bg-gradient-to-br from-card via-card to-muted/30 rounded-3xl border border-border/50 shadow-xl backdrop-blur-sm p-5 sticky top-24">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground">الموارد البشرية</h2>
              <p className="text-xs text-muted-foreground">إدارة الطلبات والموافقات</p>
            </div>
          </div>
        </div>

        {/* زر طلب جديد */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button 
            onClick={onNewRequest}
            className="w-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 text-white gap-3 h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/30 border-0"
          >
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            تقديم طلب جديد
          </Button>
        </motion.div>

        {/* الفاصل */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-3 text-xs text-muted-foreground">التنقل</span>
          </div>
        </div>

        {/* الأقسام */}
        <nav className="space-y-2">
          {sections.map((section, index) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <motion.button
                key={section.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "relative w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 text-right group",
                  isActive
                    ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                {/* Badge */}
                {section.badge && (
                  <Badge
                    className={cn(
                      "absolute -top-2 left-3 h-6 min-w-6 p-0 flex items-center justify-center text-xs font-bold rounded-full",
                      isActive 
                        ? "bg-white text-primary" 
                        : "bg-red-500 text-white animate-pulse"
                    )}
                  >
                    {section.badge}
                  </Badge>
                )}
                
                {/* Icon */}
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300",
                  isActive 
                    ? "bg-white/20" 
                    : `${section.lightBg} group-hover:scale-110`
                )}>
                  <Icon className={cn(
                    "w-5 h-5 transition-colors",
                    isActive ? "text-white" : section.iconColor
                  )} />
                </div>
                
                {/* Label */}
                <span className={cn(
                  "font-semibold flex-1 text-sm",
                  isActive ? "text-white" : "text-foreground"
                )}>
                  {section.label}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="w-1.5 h-8 bg-white/50 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer decoration */}
        <div className="mt-6 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>متصل</span>
          </div>
        </div>
      </div>
    </div>
  );
}
