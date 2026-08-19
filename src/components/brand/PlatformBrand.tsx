import type { ImgHTMLAttributes } from "react";
import kafaaLogoPremium from "@/assets/kafaa-logo-premium.png";
import kafaaLogoPremiumCropped from "@/assets/kafaa-logo-premium-cropped.png";

/**
 * Kafa'a (كفاءة) — official platform brandmark artwork (restored PNG version).
 */

type KafaaLogoArtworkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;

export function KafaaLogoArtwork({ className = "", ...props }: KafaaLogoArtworkProps) {
  return (
    <img
      src={kafaaLogoPremium}
      alt="شعار كفاءة"
      className={`object-contain ${className}`}
      {...props}
    />
  );
}

export function KafaaLogoArtworkCropped({ className = "", ...props }: KafaaLogoArtworkProps) {
  return (
    <img
      src={kafaaLogoPremiumCropped}
      alt="شعار كفاءة"
      className={`object-contain ${className}`}
      {...props}
    />
  );
}

const kafaaLogo = kafaaLogoPremium;

interface PlatformBrandProps {
  size?: "sm" | "md" | "lg";
  variant?: "horizontal" | "stacked" | "icon";
  showTagline?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { logo: "h-8 w-8", name: "text-lg", tagline: "text-[10px]" },
  md: { logo: "h-12 w-12", name: "text-2xl", tagline: "text-xs" },
  lg: { logo: "h-16 w-16", name: "text-3xl", tagline: "text-sm" },
};

/**
 * Official "كفاءة" (Kafa'a) platform brand mark.
 */
export function PlatformBrand({
  size = "md",
  variant = "horizontal",
  showTagline = true,
  className = "",
}: PlatformBrandProps) {
  const s = sizeMap[size];

  if (variant === "icon") {
    return <KafaaLogoArtwork className={`${s.logo} ${className}`} />;
  }

  const isStacked = variant === "stacked";
  return (
    <div
      className={`inline-flex ${isStacked ? "flex-col items-center gap-2" : "flex-row items-center gap-3"} ${className}`}
      dir="rtl"
    >
      <KafaaLogoArtwork className={s.logo} />
      <div className={isStacked ? "text-center" : "text-right leading-tight"}>
        <div
          className={`${s.name} font-extrabold tracking-tight bg-gradient-to-l from-cyan-500 to-slate-800 bg-clip-text text-transparent`}
        >
          كفاءة
        </div>
        {showTagline && (
          <div className={`${s.tagline} text-slate-500 font-medium mt-0.5`}>
            منصة كفاءة لإدارة التسويق الإلكتروني للجمعيات
          </div>
        )}
      </div>
    </div>
  );
}

export { kafaaLogo };
