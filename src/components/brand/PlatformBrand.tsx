import type { SVGProps } from "react";

/**
 * Kafa'a (كفاءة) — professional brandmark.
 *
 * Concept: a refined capital "K" enclosed in a circle, symbolising
 * verified performance and digital precision. The mark is rendered
 * as a scalable SVG so it stays crisp at every size and works for
 * both the full brand block and the browser favicon source.
 */

const NAVY = "hsl(215 55% 14%)";
const TEAL = "hsl(182 80% 38%)";

function KafaaMarkSvg({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
      aria-label="شعار كفاءة"
    >
      {/* Circle background */}
      <circle cx="24" cy="24" r="22" fill="#22d3ee" />
      {/* Subtle inner ring for depth */}
      <circle cx="24" cy="24" r="19" stroke="white" strokeOpacity="0.22" strokeWidth="1" />
      {/* Geometric K */}
      <g fill="#ffffff">
        {/* Vertical spine */}
        <rect x="14" y="12" width="5.5" height="24" rx="1.5" />
        {/* Upper diagonal */}
        <path d="M19.5 16.5L31 11.5C32.2 11 33.5 12 33.5 13.3V13.3C33.5 14 33.1 14.6 32.5 14.9L23.5 19.5L19.5 16.5Z" />
        {/* Lower diagonal */}
        <path d="M19.5 31.5L32.5 36.5C33.6 36.9 33.6 38.5 32.5 38.9L32.5 38.9C32.1 39.1 31.6 39 31.2 38.8L19.5 33.5V31.5Z" />
      </g>
    </svg>
  );
}

type KafaaLogoArtworkProps = SVGProps<SVGSVGElement>;

export function KafaaLogoArtwork({ className = "", ...props }: KafaaLogoArtworkProps) {
  return (
    <KafaaMarkSvg
      className={`object-contain ${className}`}
      {...props}
    />
  );
}

export function KafaaLogoArtworkCropped({ className = "", ...props }: KafaaLogoArtworkProps) {
  return (
    <KafaaMarkSvg
      className={`object-contain ${className}`}
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
            منصة كفاءة لإدارة التسويق الإلكتروني للجمعيات
          </div>
        )}
      </div>
    </div>
  );
}

export { KafaaMarkSvg as kafaaLogo };
