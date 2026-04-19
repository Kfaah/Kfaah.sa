import { cn } from "@/lib/utils";
import { User, Users } from "lucide-react";
import type { ViewScope, RoleLevel } from "@/hooks/useScopedView";

interface ScopeToggleProps {
  scope: ViewScope;
  onChange: (s: ViewScope) => void;
  roleLevel: RoleLevel;
  /** Optional count to show next to "team" tab */
  teamCount?: number;
  className?: string;
}

/**
 * Elegant pill-shaped segmented control:
 * [ شخصي  |  الفريق ]
 * Hidden when the user is a plain employee.
 * Admins only see the "team" side (since they don't have personal data).
 */
export function ScopeToggle({
  scope,
  onChange,
  roleLevel,
  teamCount,
  className,
}: ScopeToggleProps) {
  if (roleLevel === "employee") return null;

  const isAdmin = roleLevel === "admin";

  return (
    <div
      dir="rtl"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 shadow-sm",
        className
      )}
    >
      {!isAdmin && (
        <button
          type="button"
          onClick={() => onChange("personal")}
          className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
            scope === "personal"
              ? "bg-primary text-primary-foreground shadow-md"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="h-4 w-4" />
          عرض شخصي
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange("team")}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
          scope === "team" || isAdmin
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Users className="h-4 w-4" />
        {isAdmin ? "عرض الجمعية" : "عرض الفريق"}
        {typeof teamCount === "number" && teamCount > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              scope === "team" || isAdmin
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-primary/10 text-primary"
            )}
          >
            {teamCount}
          </span>
        )}
      </button>
    </div>
  );
}
