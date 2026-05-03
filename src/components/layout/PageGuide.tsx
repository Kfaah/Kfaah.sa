import { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageGuideProps {
  /** عنوان مختصر للشرح */
  title?: string;
  /** الوصف التفصيلي للأيقونة/الصفحة */
  description: ReactNode;
  /** قائمة بالميزات/الإمكانيات */
  features?: string[];
  className?: string;
}

/**
 * شريط إرشادي أنيق يُعرض أعلى كل صفحة لشرح وظيفة الأيقونة وما تقدمه الصفحة.
 * يساعد المستخدم الجديد على فهم دور الشاشة قبل البدء في استخدامها.
 */
export function PageGuide({
  title = "ما هذه الصفحة؟",
  description,
  features,
  className,
}: PageGuideProps) {
  return (
    <div
      dir="rtl"
      className={cn(
        "rounded-2xl border border-primary/20 bg-gradient-to-bl from-primary/5 via-background to-accent/5 p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Info className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          {features && features.length > 0 && (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span className="leading-relaxed">{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default PageGuide;