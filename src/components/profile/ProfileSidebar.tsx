import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

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
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="p-4 border-b border-border bg-muted/30"
      >
        <h3 className="font-semibold text-foreground">القائمة</h3>
      </motion.div>
      <nav className="p-2">
        {sections.map((section, index) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          
          return (
            <motion.button
              key={section.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
              whileHover={{ scale: 1.02, x: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all duration-200",
                isActive
                  ? "bg-gradient-to-l from-accent to-primary text-white shadow-md"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <motion.div 
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  isActive ? "bg-white/20" : "bg-muted"
                )}
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.4 }}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-white" : "text-accent")} />
              </motion.div>
              <span className="font-medium flex-1">{section.label}</span>
              {section.badge !== undefined && section.badge > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.2 + index * 0.05 }}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-accent text-white"
                  )}
                >
                  {section.badge}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </nav>
    </motion.div>
  );
}
