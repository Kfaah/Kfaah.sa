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
      style={{
        background: "linear-gradient(to left, hsl(var(--primary)) 0%, hsl(var(--primary)) 72%, hsl(var(--accent)) 100%)",
        ...style,
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl shadow-xl",
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

      <div className="relative flex min-h-[112px] flex-col gap-3 px-4 py-5 sm:min-h-[128px] sm:gap-4 sm:px-7 sm:py-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {icon && (
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-sm [&_svg]:h-5 [&_svg]:w-5 sm:[&_svg]:h-6 sm:[&_svg]:w-6">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-xs sm:text-sm text-white/85 line-clamp-2">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 [&_button]:text-xs [&_button]:sm:text-sm">{actions}</div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;