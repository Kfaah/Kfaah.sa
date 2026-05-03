import type { SVGProps } from "react";

/**
 * Kafa'a (كفاءة) — professional brandmark.
 *
 * Concept: a geometric capital "K" where the upper diagonal stroke
 * resolves into a rising checkmark — symbolising verified performance.
 * Monolinear weights, single deep-navy ink, single turquoise accent,
 * disciplined typography. Designed to read at any size.
 */

const NAVY = "hsl(215 55% 14%)";
const TEAL = "hsl(182 80% 38%)";

type KafaaLogoArtworkProps = SVGProps<SVGSVGElement>;

export function KafaaLogoArtwork({ className = "", style, ...props }: KafaaLogoArtworkProps) {
  return (
    <svg
      viewBox="0 0 640 640"
      role="img"
      aria-label="شعار كفاءة KFAAH"
      className={className}
      style={style}
      {...props}
    >
      {/* Mark sits in a perfect square at the top */}
      <g transform="translate(170 70)">
        {/* Vertical stem of K */}
        <rect x="0" y="0" width="44" height="300" rx="6" fill={NAVY} />

        {/* Lower diagonal of K (navy) */}
        <path
          d="M44 168 L188 300"
          stroke={NAVY}
          strokeWidth="44"
          strokeLinecap="round"
          fill="none"
        />

        {/* Upper diagonal of K resolves into a checkmark (teal) */}
        <path
          d="M44 168 L120 92 L300 -10"
          stroke={TEAL}
          strokeWidth="44"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Tiny accent dot — quiet signature */}
        <circle cx="312" cy="-4" r="10" fill={TEAL} />
      </g>

      {/* Hairline divider */}
      <line x1="180" y1="430" x2="460" y2="430" stroke={NAVY} strokeOpacity="0.18" strokeWidth="1.5" />

      {/* Wordmark: Arabic */}
      <text
        x="320"
        y="500"
        textAnchor="middle"
        fontFamily="'Cairo', 'Tajawal', Tahoma, Arial, sans-serif"
        fontSize="86"
        fontWeight="800"
        letterSpacing="-1"
        fill={NAVY}
      >
        كفاءة
      </text>

      {/* Wordmark: Latin — quiet, wide-tracked */}
      <text
        x="320"
        y="560"
        textAnchor="middle"
        fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
        fontSize="26"
        fontWeight="600"
        letterSpacing="14"
        fill={TEAL}
      >
        KFAAH
      </text>
    </svg>
  );
}

// Raster-friendly URL form for places that need an <img src>
const kafaaLogoSvgString = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640'><g transform='translate(170 70)'><rect x='0' y='0' width='44' height='300' rx='6' fill='${NAVY}'/><path d='M44 168 L188 300' stroke='${NAVY}' stroke-width='44' stroke-linecap='round' fill='none'/><path d='M44 168 L120 92 L300 -10' stroke='${TEAL}' stroke-width='44' stroke-linecap='round' stroke-linejoin='round' fill='none'/><circle cx='312' cy='-4' r='10' fill='${TEAL}'/></g><line x1='180' y1='430' x2='460' y2='430' stroke='${NAVY}' stroke-opacity='0.18' stroke-width='1.5'/><text x='320' y='500' text-anchor='middle' font-family='Cairo, Tajawal, Tahoma, Arial, sans-serif' font-size='86' font-weight='800' fill='${NAVY}'>كفاءة</text><text x='320' y='560' text-anchor='middle' font-family='Inter, Helvetica Neue, Arial, sans-serif' font-size='26' font-weight='600' letter-spacing='14' fill='${TEAL}'>KFAAH</text></svg>`;

const kafaaLogo = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(kafaaLogoSvgString)}`;

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