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
import atefLogoIcon from "@/assets/atef-logo-icon-transparent.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  iconBg: string;
}

const mainNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/", icon: LayoutDashboard, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الموظفين", href: "/employees", icon: Users, iconBg: "bg-gradient-to-br from-blue-400 to-blue-500" },
  { title: "الأدوار والصلاحيات", href: "/roles", icon: UserCog, iconBg: "bg-gradient-to-br from-pink-400 to-pink-500" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, badge: 18, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "الخطط", href: "/plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "التقارير", href: "/reports", icon: BarChart3, iconBg: "bg-gradient-to-br from-rose-400 to-rose-500" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
  { title: "المراسلات", href: "/messages", icon: MessageSquare, badge: 5, iconBg: "bg-gradient-to-br from-teal-400 to-emerald-500" },
];

const settingsNavItem: NavItem = { 
  title: "الإعدادات", 
  href: "/settings", 
  icon: Settings, 
  iconBg: "bg-gradient-to-br from-slate-400 to-slate-500" 
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-4 px-4 py-3 rounded-full transition-all duration-300",
          isActive
            ? "bg-gradient-to-r from-cyan-400 to-teal-400 text-white shadow-lg shadow-cyan-400/30"
            : "bg-white text-slate-700 hover:shadow-lg"
        )}
      >
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-md",
          isActive ? "bg-white/20" : item.iconBg
        )}>
          <item.icon className="w-6 h-6 text-white" />
        </div>
        {!collapsed && (
          <>
            <span className={cn(
              "font-bold text-base flex-1 text-right",
              isActive ? "text-white" : "text-slate-700"
            )}>
              {item.title}
            </span>
            {item.badge && (
              <span className={cn(
                "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center",
                isActive ? "bg-white/25 text-white" : "bg-amber-400 text-white"
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
        "fixed right-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 overflow-hidden",
        collapsed ? "w-24" : "w-80"
      )}
    >
      {/* White Header Section with Logo */}
      <div className="bg-white relative">
        {/* Curved bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-b from-cyan-400 to-cyan-500" style={{ 
          clipPath: 'ellipse(70% 100% at 50% 100%)' 
        }} />
        
        <div className="p-6 pb-12 flex flex-col items-center relative z-10">
          {/* Logo with simple elegant animation */}
          <div className="relative mb-5 group">
            {/* Outer rotating ring */}
            <div 
              className="absolute inset-[-8px] w-[160px] h-[160px] rounded-full border-4 border-accent/30 border-t-accent animate-spin" 
              style={{ animationDuration: '8s' }} 
            />
            
            {/* Inner glow circle */}
            <div 
              className="absolute inset-2 w-[136px] h-[136px] rounded-full bg-gradient-to-br from-accent/20 to-primary/10 animate-pulse" 
              style={{ animationDuration: '3s' }} 
            />
            
            {/* Logo container - white background */}
            <div className="relative w-36 h-36 rounded-full bg-white border-4 border-white flex items-center justify-center shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
              <img 
                src={atefLogoIcon} 
                alt="جمعية عطف" 
                className="w-28 h-28 object-contain" 
              />
            </div>
            
            {/* Decorative dot */}
            <div 
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-lg animate-bounce" 
              style={{ animationDuration: '2s' }} 
            />
          </div>
          
          {/* Text under logo - REDESIGNED */}
          {!collapsed && (
            <div className="text-center space-y-3">
              {/* جمعية عطف للأيتام - on one line */}
              <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap tracking-wide">
                جمعية عطف للأيتام
              </h1>
              
              {/* نظام إدارة التسويق الإلكتروني - styled nicely */}
              <div className="relative">
                <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-l from-cyan-600 via-teal-500 to-cyan-600">
                  نظام إدارة التسويق الإلكتروني
                </p>
                {/* Decorative line under */}
                <div className="mt-2 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cyan Navigation Section */}
      <div className="flex-1 bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600 flex flex-col min-h-0">
        {/* User Profile Card - overlapping */}
        {!collapsed && (
          <div className="mx-4 -mt-4 mb-4 bg-white rounded-2xl p-4 shadow-lg border border-white/50 relative z-20 flex-shrink-0">
            <div className="flex items-center gap-4 flex-row-reverse">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-emerald-400 shadow-md">
                <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xl font-bold text-white">
                  ج
                </div>
              </div>
              <div className="text-right flex-1">
                <h3 className="font-bold text-slate-800 text-base">جابر الحريصي</h3>
                <div className="flex items-center gap-2 justify-end mt-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-sm text-cyan-600 font-semibold bg-white rounded-full px-3 py-1 border border-cyan-200 shadow-sm">
                    % مدير النظام
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items - Scrollable with Settings inside */}
        <nav 
          className="flex-1 px-4 space-y-2.5 py-3 min-h-0 overflow-y-scroll"
          dir="ltr"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.4) transparent'
          }}
        >
          <div className="space-y-2.5" dir="rtl">
            {mainNavItems.map((item, index) => (
              <div 
                key={item.href} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <NavLink item={item} />
              </div>
            ))}
            
            {/* Settings inside scroll */}
            <div className="pt-3 mt-3 border-t border-white/20">
              <NavLink item={settingsNavItem} />
            </div>
          </div>
        </nav>

        {/* Collapse Button Only */}
        <div className="p-3 border-t border-white/20 flex-shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors text-sm backdrop-blur-sm"
          >
            {collapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="font-medium">طي القائمة</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
