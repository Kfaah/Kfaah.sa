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
import atefLogoIcon from "@/assets/atef-logo-icon.jpg";
import atefLogoText from "@/assets/atef-logo-text.jpg";

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
            : "bg-white text-foreground hover:shadow-md"
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
        "fixed right-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 border-l border-white/50 shadow-xl overflow-hidden",
        collapsed ? "w-24" : "w-80"
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-400 via-cyan-300 to-cyan-200" />
      
      {/* Logo Section with lighter background */}
      <div className="relative p-6 flex flex-col items-center bg-gradient-to-b from-cyan-300/50 to-transparent">
        <div className="relative mb-4 group">
          {/* Outer rotating ring */}
          <div className="absolute inset-[-4px] w-[120px] h-[120px] rounded-full border-4 border-transparent border-t-white border-r-white/50 animate-spin" style={{ animationDuration: '6s' }} />
          
          {/* Second rotating ring (opposite direction) */}
          <div className="absolute inset-[-8px] w-[128px] h-[128px] rounded-full border-2 border-transparent border-b-white/40 border-l-white/20 animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }} />
          
          {/* Inner glow circle with pulse */}
          <div className="absolute inset-1 w-[104px] h-[104px] rounded-full bg-white/30 animate-pulse" style={{ animationDuration: '2.5s' }} />
          
          {/* Logo icon container */}
          <div className="relative w-28 h-28 rounded-full bg-white border-4 border-white/80 flex items-center justify-center overflow-hidden shadow-xl group-hover:shadow-2xl transition-shadow duration-500">
            <img 
              src={atefLogoIcon} 
              alt="جمعية عطف" 
              className="w-20 h-20 object-contain group-hover:scale-110 transition-transform duration-500" 
            />
          </div>
          
          {/* Decorative floating dots */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg animate-bounce" style={{ animationDuration: '1.5s' }} />
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/80 shadow animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/80 shadow animate-bounce" style={{ animationDuration: '2.2s', animationDelay: '0.3s' }} />
        </div>
        
        {/* Text logo under icon */}
        {!collapsed && (
          <div className="text-center animate-fade-in">
            <img 
              src={atefLogoText} 
              alt="جمعية عطف للأيتام" 
              className="h-12 object-contain mx-auto hover:scale-105 transition-transform duration-300 drop-shadow-sm"
            />
            <p className="text-xs text-primary/70 mt-2 font-medium">نظام إدارة التسويق الإلكتروني</p>
          </div>
        )}
      </div>

      {/* User Profile Card */}
      {!collapsed && (
        <div className="relative mx-4 mb-4 bg-white rounded-2xl p-4 shadow-md">
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
      <nav className="relative flex-1 px-4 space-y-2 overflow-y-auto py-2">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        
        <div className="my-4 border-t border-white/30" />
        
        {reportsNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        
        <div className="my-4 border-t border-white/30" />
        
        {communicationNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Settings & Collapse */}
      <div className="relative p-4 border-t border-white/30 space-y-2">
        <NavLink item={settingsNavItem} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-white/80 hover:bg-white/20 transition-colors"
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
