import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";

interface DashboardLayoutProps {
  children: ReactNode;
  embedded?: boolean;
}

export function DashboardLayout({ children, embedded = false }: DashboardLayoutProps) {
  // Embedded mode: when the page is rendered inside an iframe of the admin
  // internal dashboard, hide the org sidebar so only the page content shows.
  const isEmbedded = embedded ||
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "1";

  const location = useLocation();
  const branding = useOrgBranding();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname, location.search]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-background">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar — visible only on mobile */}
      <header
        className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 shadow-md"
        style={{ backgroundColor: branding.primary || "hsl(var(--primary))" }}
        dir="rtl"
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-white/30 active:scale-95 transition"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          {branding.logoUrl && (
            <div className="h-9 w-9 rounded-full bg-white p-1 shadow-sm flex-shrink-0">
              <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
            </div>
          )}
          <span className="text-white font-bold text-sm truncate">
            {branding.orgName || "الجمعية"}
          </span>
        </div>
      </header>

      {/* Sidebar: always rendered. On mobile it's a slide-in drawer. */}
      <div
        className={
          // Desktop: normal fixed sidebar (handled inside Sidebar via fixed positioning).
          // Mobile: slide-in/out container.
          "lg:block " +
          (mobileOpen
            ? "fixed inset-0 z-50 lg:static"
            : "hidden lg:block")
        }
      >
        {/* Mobile backdrop */}
        {mobileOpen && (
          <div
            className="lg:hidden absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden absolute top-4 left-4 z-[60] flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-foreground shadow-lg"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <Sidebar />
      </div>

      {/* Main content */}
      <div className="lg:mr-[320px] transition-all duration-300">
        <main className="px-3 py-4 sm:px-5 sm:py-6 lg:px-6 lg:py-8">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
