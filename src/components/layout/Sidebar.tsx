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
  iconBg?: string;
}

const mainNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/", icon: LayoutDashboard, iconColor: "text-white", iconBg: "bg-accent" },
  { title: "الموظفين", href: "/employees", icon: Users, iconColor: "text-white", iconBg: "bg-rose-400" },
  { title: "الأدوار والصلاحيات", href: "/roles", icon: UserCog, iconColor: "text-white", iconBg: "bg-violet-400" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, badge: 18, iconColor: "text-white", iconBg: "bg-amber-400" },
  { title: "الخطط", href: "/plans", icon: CalendarCheck, iconColor: "text-white", iconBg: "bg-emerald-400" },
];

const reportsNavItems: NavItem[] = [
  { title: "التقارير", href: "/reports", icon: BarChart3, iconColor: "text-white", iconBg: "bg-blue-400" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconColor: "text-white", iconBg: "bg-orange-400" },
];

const communicationNavItems: NavItem[] = [
  { title: "المراسلات", href: "/messages", icon: MessageSquare, badge: 5, iconColor: "text-white", iconBg: "bg-pink-400" },
];

const settingsNavItem: NavItem = { title: "الإعدادات", href: "/settings", icon: Settings, iconColor: "text-white", iconBg: "bg-slate-400" };

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group",
          isActive
            ? "bg-accent text-white shadow-lg"
            : "text-foreground hover:bg-muted"
        )}
      >
        <div className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shadow-sm",
          isActive ? "bg-white/20" : item.iconBg
        )}>
          <item.icon className={cn("w-5 h-5", item.iconColor)} />
        </div>
        {!collapsed && (
          <>
            <span className={cn(
              "font-semibold text-base",
              isActive ? "text-white" : "text-foreground"
            )}>
              {item.title}
            </span>
            {item.badge && (
              <span className={cn(
                "mr-auto text-xs font-bold px-2.5 py-1 rounded-full",
                isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
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
        "fixed right-0 top-0 h-screen bg-white flex flex-col transition-all duration-300 z-50 border-l border-border shadow-lg",
        collapsed ? "w-24" : "w-80"
      )}
    >
      {/* Logo with Animation */}
      <div className="p-6 flex flex-col items-center">
        <div className="relative mb-4">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-accent/30 border-t-accent animate-spin" style={{ animationDuration: '8s' }} />
          
          {/* Inner glow circle */}
          <div className="absolute inset-2 w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-primary/10 animate-pulse" style={{ animationDuration: '3s' }} />
          
          {/* Logo container */}
          <div className="relative w-28 h-28 rounded-full bg-white border-4 border-accent/20 flex items-center justify-center p-3 shadow-xl">
            <img 
              src={atefLogo} 
              alt="جمعية عطف" 
              className="w-full h-full object-contain drop-shadow-md hover:scale-110 transition-transform duration-300" 
            />
          </div>
          
          {/* Decorative dot */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-lg animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
        
        {/* Text under logo */}
        {!collapsed && (
          <div className="text-center">
            <h2 className="font-bold text-lg text-primary">منصة بطل</h2>
            <p className="text-sm text-muted-foreground">للسلاسل التعليمية</p>
          </div>
        )}
      </div>

      {/* User Profile Card */}
      {!collapsed && (
        <div className="mx-4 mb-4 bg-muted/50 rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-3 flex-row-reverse">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xl font-bold text-white shadow-lg">
              ج
            </div>
            <div className="text-right flex-1">
              <h3 className="font-bold text-foreground">جابر الحريصي</h3>
              <span className="inline-block mt-1 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold border border-accent/20">
                % مدير النظام
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        
        <div className="my-4 border-t border-border" />
        
        {reportsNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        
        <div className="my-4 border-t border-border" />
        
        {communicationNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Settings & Collapse */}
      <div className="p-4 border-t border-border space-y-2">
        <NavLink item={settingsNavItem} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-muted transition-colors"
        >
          {collapsed ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <>
              <ChevronRight className="w-5 h-5" />
              <span className="text-sm font-medium">طي القائمة</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
