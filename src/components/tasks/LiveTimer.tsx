import { useState, useEffect } from "react";
import { Clock, Play } from "lucide-react";
import { formatNumberPlain } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LiveTimerProps {
  startedAt: string;
  estimatedMinutes?: number | null;
}

export function LiveTimer({ startedAt, estimatedMinutes }: LiveTimerProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const calculateElapsed = () => {
      const startTime = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const minutes = Math.floor((now - startTime) / (1000 * 60));
      setElapsedMinutes(minutes);
    };

    // حساب فوري
    calculateElapsed();

    // تحديث كل دقيقة
    const interval = setInterval(calculateElapsed, 60000);

    return () => clearInterval(interval);
  }, [startedAt]);

  // حساب النسبة من الوقت المقدر
  const isOverTime = estimatedMinutes ? elapsedMinutes > estimatedMinutes : false;
  const progressPercent = estimatedMinutes ? Math.min((elapsedMinutes / estimatedMinutes) * 100, 100) : 0;

  // تنسيق الوقت (ساعات:دقائق)
  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${formatNumberPlain(minutes)} د`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${formatNumberPlain(hours)}:${String(mins).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold animate-pulse",
        isOverTime 
          ? "bg-rose-100 text-rose-700 border border-rose-300" 
          : "bg-sky-100 text-sky-700 border border-sky-300"
      )}>
        <Play className="w-3 h-3" />
        <span style={{ fontFamily: 'Arial, sans-serif' }}>
          {formatTime(elapsedMinutes)}
        </span>
      </div>
      
      {/* شريط التقدم */}
      {estimatedMinutes && (
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              isOverTime ? "bg-rose-500" : "bg-sky-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
