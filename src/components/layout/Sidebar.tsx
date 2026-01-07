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
        
        <div className="p-6 pb-10 flex flex-col items-center relative z-10">
          {/* Logo with animated ring */}
          <div className="relative mb-3">
            {/* Outer decorative ring */}
            <div className="absolute inset-[-8px] rounded-full border-4 border-dashed border-cyan-300 animate-spin" style={{ animationDuration: '20s' }} />
            
            {/* Main ring */}
            <div 
              className="absolute inset-[-4px] rounded-full border-4 border-cyan-400/60 border-t-cyan-500 animate-spin" 
              style={{ animationDuration: '6s' }} 
            />
            
            {/* Logo container */}
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-slate-50 to-white border-4 border-cyan-200 flex items-center justify-center shadow-xl overflow-hidden">
              <img 
                src={atefLogoIcon} 
                alt="جمعية عطف" 
                className="w-16 h-16 object-contain hover:scale-110 transition-transform duration-300" 
              />
            </div>
            
            {/* Decorative dots */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow animate-bounce" style={{ animationDuration: '2s' }} />
          </div>
          
          {/* Text under logo */}
          {!collapsed && (
            <div className="text-center">
              <img 
                src={atefLogoText} 
                alt="جمعية عطف للأيتام" 
                className="h-10 object-contain mx-auto"
              />
              <p className="text-[10px] text-slate-500 mt-1 font-medium">نظام إدارة التسويق الإلكتروني</p>
            </div>
          )}
        </div>
      </div>

      {/* Cyan Navigation Section */}
      <div className="flex-1 bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600 flex flex-col">
        {/* User Profile Card - overlapping */}
        {!collapsed && (
          <div className="mx-4 -mt-4 mb-4 bg-white rounded-2xl p-4 shadow-lg border border-white/50 relative z-20">
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

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-2 overflow-y-auto py-2">
          {mainNavItems.map((item, index) => (
            <div 
              key={item.href} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <NavLink item={item} />
            </div>
          ))}
        </nav>

        {/* Settings & Collapse */}
        <div className="p-3 space-y-2 border-t border-white/20">
          <NavLink item={settingsNavItem} />
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
