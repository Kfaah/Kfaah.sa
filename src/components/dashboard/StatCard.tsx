import { LucideIcon } from "lucide-react";
import { cn, formatNumberPlain, rtlIsolate } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon: LucideIcon;
  variant?: "default" | "primary" | "accent" | "success";
  delay?: number;
}

export function StatCard({ title, value, change, icon: Icon, variant = "default", delay = 0 }: StatCardProps) {
  const variants = {
    default: "bg-card",
    primary: "bg-primary text-primary-foreground",
    accent: "bg-accent text-accent-foreground",
    success: "bg-success text-success-foreground",
  };

  const iconBg = {
    default: "bg-primary/10 text-primary",
    primary: "bg-primary-foreground/20 text-primary-foreground",
    accent: "bg-accent-foreground/20 text-accent-foreground",
    success: "bg-success-foreground/20 text-success-foreground",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up",
        variants[variant]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-sm font-medium", variant === "default" ? "text-muted-foreground" : "opacity-80")}>
            {title}
          </p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {change && (
            <p
              className={cn(
                "text-sm mt-2 font-medium",
                change.type === "increase" ? "text-success" : "text-destructive",
                variant !== "default" && "opacity-90"
              )}
            >
              {rtlIsolate(
                `${change.type === "increase" ? "+" : "-"}%${formatNumberPlain(Math.abs(change.value))}`
              )}{" "}
              <span className="opacity-70">من الشهر الماضي</span>
            </p>
          )}
        </div>
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", iconBg[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
