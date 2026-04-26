import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

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

  if (isEmbedded) {
    return (
      <div className="min-h-screen bg-background">
        <main className="p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="mr-80 transition-all duration-300">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
