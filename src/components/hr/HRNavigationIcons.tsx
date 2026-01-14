import { ClipboardList, UserCheck, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type HRSection = "my-requests" | "pending-approvals" | "my-approvals-history";

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
  const sections = [
    {
      id: "my-requests" as HRSection,
      label: "طلباتي",
      icon: ClipboardList,
      color: "bg-blue-500",
      activeGradient: "from-blue-500 to-blue-600",
      badge: null,
    },
    {
      id: "pending-approvals" as HRSection,
      label: "موافقات معلقة",
      icon: UserCheck,
      color: "bg-amber-500",
      activeGradient: "from-amber-500 to-orange-500",
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
      badgeVariant: "destructive" as const,
    },
    {
      id: "my-approvals-history" as HRSection,
      label: "سجل موافقاتي",
      icon: CheckCircle2,
      color: "bg-emerald-500",
      activeGradient: "from-emerald-500 to-teal-500",
      badge: approvalsHistoryCount > 0 ? approvalsHistoryCount : null,
      badgeColor: "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        
        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 p-4 sm:p-6 rounded-xl border-2 transition-all duration-200",
              isActive
                ? `bg-gradient-to-br ${section.activeGradient} text-white border-transparent shadow-lg scale-[1.02]`
                : "bg-card hover:bg-muted/50 border-border hover:border-primary/30 text-foreground"
            )}
          >
            {/* Badge */}
            {section.badge && (
              <Badge
                variant={section.badgeVariant || "secondary"}
                className={cn(
                  "absolute -top-2 -left-2 h-6 min-w-6 p-0 flex items-center justify-center text-xs font-bold",
                  !section.badgeVariant && section.badgeColor
                )}
              >
                {section.badge}
              </Badge>
            )}
            
            {/* Icon */}
            <div className={cn(
              "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center",
              isActive ? "bg-white/20" : "bg-muted"
            )}>
              <Icon className={cn(
                "w-6 h-6 sm:w-7 sm:h-7",
                isActive ? "text-white" : "text-muted-foreground"
              )} />
            </div>
            
            {/* Label */}
            <span className={cn(
              "text-xs sm:text-sm font-semibold text-center",
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
