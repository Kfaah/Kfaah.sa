import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface ProfileSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface ProfileSidebarProps {
  sections: ProfileSection[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export function ProfileSidebar({
  sections,
  activeSection,
  onSectionChange,
}: ProfileSidebarProps) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="font-semibold text-foreground">القائمة</h3>
      </div>
      <nav className="p-2">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all duration-200",
                isActive
                  ? "bg-gradient-to-l from-accent to-primary text-white shadow-md"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                isActive ? "bg-white/20" : "bg-muted"
              )}>
                <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-accent")} />
              </div>
              <span className="font-medium flex-1">{section.label}</span>
              {section.badge !== undefined && section.badge > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-accent text-white"
                )}>
                  {section.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
