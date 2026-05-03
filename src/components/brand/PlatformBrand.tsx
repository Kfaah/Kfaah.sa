import type { SVGProps } from "react";

const kafaaLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="86" fill="transparent"/><path d="M151 206c33-50 82-80 140-80 42 0 80 16 108 43" fill="none" stroke="hsl(213 58% 16%)" stroke-width="22" stroke-linecap="round"/><path d="M128 239l73 74 178-180" fill="none" stroke="hsl(182 77% 45%)" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/><path d="M133 239l68 69 173-175" fill="none" stroke="hsl(182 77% 45%)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity=".28"/><path d="M168 182h54v117" fill="none" stroke="hsl(213 58% 16%)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="M222 238l70-75" fill="none" stroke="hsl(213 58% 16%)" stroke-width="24" stroke-linecap="round"/><text x="256" y="402" text-anchor="middle" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="72" font-weight="800" fill="hsl(213 58% 16%)">كفاءة</text><text x="256" y="448" text-anchor="middle" font-family="Avenir Next, Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="3" fill="hsl(182 77% 36%)">KFAAH</text></svg>`;

const kafaaLogo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(kafaaLogoSvg)}`;

type KafaaLogoArtworkProps = SVGProps<SVGSVGElement>;

export function KafaaLogoArtwork({ className = "", style, ...props }: KafaaLogoArtworkProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label="شعار كفاءة KFAAH"
      className={className}
      style={style}
      {...props}
    >
      <path
        d="M151 206c33-50 82-80 140-80 42 0 80 16 108 43"
        fill="none"
        stroke="hsl(213 58% 16%)"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d="M128 239l73 74 178-180"
        fill="none"
        stroke="hsl(182 77% 45%)"
        strokeWidth="38"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M133 239l68 69 173-175"
        fill="none"
        stroke="hsl(182 77% 45%)"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
      <path
        d="M168 182h54v117"
        fill="none"
        stroke="hsl(213 58% 16%)"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M222 238l70-75"
        fill="none"
        stroke="hsl(213 58% 16%)"
        strokeWidth="24"
        strokeLinecap="round"
      />
      <text
        x="256"
        y="402"
        textAnchor="middle"
        fontFamily="Cairo, Tahoma, Arial, sans-serif"
        fontSize="72"
        fontWeight="800"
        fill="hsl(213 58% 16%)"
      >
        كفاءة
      </text>
      <text
        x="256"
        y="448"
        textAnchor="middle"
        fontFamily="Avenir Next, Arial, sans-serif"
        fontSize="34"
        fontWeight="700"
        letterSpacing="3"
        fill="hsl(182 77% 36%)"
      >
        KFAAH
      </text>
    </svg>
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