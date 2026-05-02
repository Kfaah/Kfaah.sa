import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "danger" | "warning" | "info" | "default";

export interface ConfirmOptions {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  /** للتأكيدات الحرجة: يطلب من المستخدم كتابة كلمة محددة قبل التفعيل */
  requireText?: string;
}

type Resolver = (value: boolean) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmDialogProvider>");
  }
  return ctx.confirm;
}

const variantStyles: Record<ConfirmVariant, {
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  confirmClass: string;
  ring: string;
}> = {
  danger: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    Icon: Trash2,
    confirmClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ring: "ring-destructive/20",
  },
  warning: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
    confirmClass: "bg-amber-600 text-white hover:bg-amber-700",
    ring: "ring-amber-500/20",
  },
  info: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    Icon: Info,
    confirmClass: "bg-primary text-primary-foreground hover:bg-primary/90",
    ring: "ring-primary/20",
  },
  default: {
    iconBg: "bg-muted",
    iconColor: "text-foreground",
    Icon: HelpCircle,
    confirmClass: "",
    ring: "ring-border",
  },
};

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions>({});
  const [typed, setTyped] = React.useState("");
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setTyped("");
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = (result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  };

  const variant = options.variant ?? "default";
  const v = variantStyles[variant];
  const Icon = v.Icon;
  const requireText = options.requireText?.trim();
  const requireMet = !requireText || typed.trim() === requireText;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) handleClose(false);
        }}
      >
        <AlertDialogContent
          dir="rtl"
          className="max-w-md overflow-hidden border-border/60 p-0 sm:rounded-2xl"
        >
          <div className="flex flex-col items-center gap-4 px-6 pt-7 pb-2 text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full ring-8",
                v.iconBg,
                v.ring
              )}
            >
              <Icon className={cn("h-6 w-6", v.iconColor)} />
            </div>
            <AlertDialogHeader className="space-y-2 text-center sm:text-center">
              <AlertDialogTitle className="text-center text-lg font-bold leading-snug text-foreground">
                {options.title ?? "تأكيد الإجراء"}
              </AlertDialogTitle>
              {options.description && (
                <AlertDialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
                  {options.description}
                </AlertDialogDescription>
              )}
            </AlertDialogHeader>
          </div>

          {requireText && (
            <div className="px-6 pb-2">
              <label className="block text-xs font-medium text-muted-foreground">
                للتأكيد، اكتب: <span className="font-bold text-foreground">{requireText}</span>
              </label>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                dir="auto"
              />
            </div>
          )}

          <AlertDialogFooter className="flex-row-reverse gap-2 border-t border-border/60 bg-muted/30 px-6 py-4 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction
              disabled={!requireMet}
              onClick={() => handleClose(true)}
              className={cn("min-w-[100px] font-semibold shadow-sm", v.confirmClass)}
            >
              {options.confirmText ?? "تأكيد"}
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={() => handleClose(false)}
              className="mt-0 min-w-[100px] font-medium"
            >
              {options.cancelText ?? "إلغاء"}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}