import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
  CalendarCheck,
  MessageSquare,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import atefLogo from "@/assets/atef-logo.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  iconColor?: string;
}

const mainNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/", icon: LayoutDashboard, iconColor: "text-accent" },
  { title: "الموظفين", href: "/employees", icon: Users, iconColor: "text-rose-500" },
  { title: "الأدوار والصلاحيات", href: "/roles", icon: UserCog, iconColor: "text-violet-500" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, badge: 18, iconColor: "text-amber-500" },
  { title: "الخطط", href: "/plans", icon: CalendarCheck, iconColor: "text-emerald-500" },
];

const reportsNavItems: NavItem[] = [
  { title: "التقارير", href: "/reports", icon: BarChart3, iconColor: "text-blue-500" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconColor: "text-orange-500" },
];

const communicationNavItems: NavItem[] = [
  { title: "المراسلات", href: "/messages", icon: MessageSquare, badge: 5, iconColor: "text-pink-500" },
];

const settingsNavItem: NavItem = { title: "الإعدادات", href: "/settings", icon: Settings, iconColor: "text-slate-500" };

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group relative",
          isActive
            ? "bg-accent text-accent-foreground shadow-md"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          isActive ? "bg-white/20" : "bg-sidebar-accent"
        )}>
          <item.icon className={cn("w-5 h-5", isActive ? "text-white" : item.iconColor)} />
        </div>
        {!collapsed && (
          <>
            <span className={cn("font-medium text-sm", isActive && "text-white")}>{item.title}</span>
            {item.badge && (
              <span className={cn(
                "mr-auto text-xs font-bold px-2.5 py-1 rounded-full",
                isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-600"
              )}>
                {item.badge}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 h-screen bg-sidebar flex flex-col transition-all duration-300 z-50 border-l border-sidebar-border",
        collapsed ? "w-24" : "w-72"
      )}
    >
      {/* Logo & User Profile */}
      <div className="p-6">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-primary/10 border-4 border-accent/30 flex items-center justify-center p-2 shadow-lg">
            <img src={atefLogo} alt="جمعية عطف" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* User Profile Card */}
        {!collapsed && (
          <div className="bg-sidebar-accent rounded-2xl p-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/70 mx-auto mb-3 flex items-center justify-center text-xl font-bold text-primary-foreground shadow-md">
              ج
            </div>
            <h3 className="font-bold text-sidebar-foreground">جابر الحريصي</h3>
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">
              % مدير النظام
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        
        <div className="my-4 border-t border-sidebar-border" />
        
        {reportsNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        
        <div className="my-4 border-t border-sidebar-border" />
        
        {communicationNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Settings & Collapse */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <NavLink item={settingsNavItem} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <>
              <ChevronRight className="w-5 h-5" />
              <span className="text-sm">طي القائمة</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
