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
        "rounded-2xl border-2 border-primary/40 bg-gradient-to-bl from-primary/15 via-primary/5 to-accent/15 p-5 shadow-md",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30">
          <Info className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-base sm:text-lg font-bold text-foreground">{title}</h3>
          <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/85 font-medium">
            {description}
          </p>
          {features && features.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-[13px] sm:text-sm text-foreground/80"
                >
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary ring-2 ring-primary/30" />
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