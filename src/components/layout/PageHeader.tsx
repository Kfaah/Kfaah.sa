import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Optional inline style (e.g. to override the gradient background). */
  style?: React.CSSProperties;
}

/**
 * Unified internal page header.
 * Uses the active organization branding (primary/accent) as a bold gradient banner,
 * making the brand color the dominant visual on every internal page.
 */
export function PageHeader({ icon, title, subtitle, actions, className, style }: PageHeaderProps) {
  return (
    <div
      dir="rtl"
      style={style}
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-xl",
        "bg-gradient-to-l from-primary via-primary to-accent",
        className
      )}
    >
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 -bottom-32 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-center gap-4 min-w-0">
          {icon && (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-sm">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-white/85 sm:text-base">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;