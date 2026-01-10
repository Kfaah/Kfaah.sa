import { useState, useEffect, useRef } from "react";
import { Clock, Play, Bell } from "lucide-react";
import { formatNumberPlain } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LiveTimerProps {
  startedAt: string;
  estimatedMinutes?: number | null;
}

// دالة لتشغيل صوت تنبيه باستخدام Web Audio API
const playAlertSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // إنشاء ثلاث نغمات متتالية للتنبيه
    const playBeep = (startTime: number, frequency: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    playBeep(now, 880, 0.15);        // A5
    playBeep(now + 0.2, 988, 0.15);  // B5
    playBeep(now + 0.4, 1047, 0.3);  // C6
    
  } catch (error) {
    console.log("لا يمكن تشغيل صوت التنبيه:", error);
  }
};

export function LiveTimer({ startedAt, estimatedMinutes }: LiveTimerProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [alertPlayed, setAlertPlayed] = useState(false);
  const [showAlertBadge, setShowAlertBadge] = useState(false);

  useEffect(() => {
    const calculateElapsed = () => {
      const startTime = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const minutes = Math.floor((now - startTime) / (1000 * 60));
      setElapsedMinutes(minutes);

      // التحقق من اقتراب انتهاء الوقت (قبل 5 دقائق)
      if (estimatedMinutes && !alertPlayed) {
        const remainingMinutes = estimatedMinutes - minutes;
        
        if (remainingMinutes <= 5 && remainingMinutes > 0) {
          playAlertSound();
          setAlertPlayed(true);
          setShowAlertBadge(true);
          
          // إخفاء شارة التنبيه بعد 10 ثواني
          setTimeout(() => setShowAlertBadge(false), 10000);
        }
      }
    };

    // حساب فوري
    calculateElapsed();

    // تحديث كل دقيقة
    const interval = setInterval(calculateElapsed, 60000);

    return () => clearInterval(interval);
  }, [startedAt, estimatedMinutes, alertPlayed]);

  // حساب الوقت المتبقي
  const remainingMinutes = estimatedMinutes ? estimatedMinutes - elapsedMinutes : null;
  const isNearEnd = remainingMinutes !== null && remainingMinutes <= 5 && remainingMinutes > 0;
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
    <div className="flex flex-col items-center gap-1 relative">
      {/* شارة التنبيه */}
      {showAlertBadge && (
        <div className="absolute -top-2 -right-2 animate-bounce">
          <div className="bg-amber-500 text-white rounded-full p-1">
            <Bell className="w-3 h-3" />
          </div>
        </div>
      )}
      
      <div className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold",
        isOverTime 
          ? "bg-rose-100 text-rose-700 border border-rose-300 animate-pulse" 
          : isNearEnd
            ? "bg-amber-100 text-amber-700 border border-amber-300 animate-pulse"
            : "bg-sky-100 text-sky-700 border border-sky-300 animate-pulse"
      )}>
        <Play className="w-3 h-3" />
        <span style={{ fontFamily: 'Arial, sans-serif' }}>
          {formatTime(elapsedMinutes)}
        </span>
      </div>

      {/* عرض الوقت المتبقي */}
      {remainingMinutes !== null && remainingMinutes > 0 && (
        <div className={cn(
          "text-[10px] font-medium",
          isNearEnd ? "text-amber-600" : "text-muted-foreground"
        )}>
          متبقي: {formatTime(remainingMinutes)}
        </div>
      )}
      
      {/* شريط التقدم */}
      {estimatedMinutes && (
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              isOverTime 
                ? "bg-rose-500" 
                : isNearEnd 
                  ? "bg-amber-500"
                  : "bg-sky-500"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
