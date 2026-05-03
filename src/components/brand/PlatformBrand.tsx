import type { SVGProps } from "react";
import kafaaLogoPro from "@/assets/kafaa-logo-pro.png";

const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 760"><defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="white" flood-opacity=".92"/><feDropShadow dx="0" dy="0" stdDeviation="18" flood-color="white" flood-opacity=".5"/></filter></defs><g filter="url(#glow)"><path fill="hsl(210 58% 14%)" d="M170 86h104v252L491 86h127L380 359l255 315H499L274 395v279H170z"/><path fill="hsl(178 58% 47%)" d="M359 395 515 225l65 65-156 170 222 176-76 77z"/><circle cx="681" cy="161" r="22" fill="hsl(178 58% 47%)"/><circle cx="736" cy="236" r="16" fill="hsl(178 58% 47%)"/><circle cx="699" cy="307" r="11" fill="hsl(178 58% 47%)"/><path fill="hsl(178 58% 47%)" d="m756 110 14 29 32 5-23 23 6 32-29-15-29 15 6-32-23-23 32-5z"/><text x="505" y="570" text-anchor="middle" direction="rtl" unicode-bidi="bidi-override" font-family="Tajawal, Arial, sans-serif" font-weight="800" font-size="130" fill="hsl(210 58% 14%)">كفاءة</text><text x="510" y="651" text-anchor="middle" font-family="Tajawal, Arial, sans-serif" font-weight="700" font-size="78" letter-spacing="7" fill="hsl(178 58% 47%)">kfaah</text><path d="M249 690h521" stroke="hsl(178 58% 47%)" stroke-width="10" stroke-linecap="round"/></g></svg>`;
const kafaaLogo = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(logoSvg)}`;

type KafaaLogoArtworkProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">;

export function KafaaLogoArtwork({ className = "", style, ...props }: KafaaLogoArtworkProps) {
  return (
    <img
      src={kafaaLogoPro}
      alt="كفاءة kfaah"
      className={className}
      style={style}
      width={1024}
      height={1024}
      {...props}
    />
  );
}

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
 * Used on auth pages, demo welcome screen, and any place where the
 * platform identity (not an organization's identity) should appear.
 */
export function PlatformBrand({
  size = "md",
  variant = "horizontal",
  showTagline = true,
  className = "",
}: PlatformBrandProps) {
  const s = sizeMap[size];

  if (variant === "icon") {
    return (
      <KafaaLogoArtwork className={`${s.logo} ${className}`} />
    );
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
            منصة إدارة الأداء المؤسسي للجمعيات
          </div>
        )}
      </div>
    </div>
  );
}

export { kafaaLogo };