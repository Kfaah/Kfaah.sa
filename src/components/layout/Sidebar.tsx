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
        
        <div className="p-6 pb-12 flex flex-col items-center relative z-10">
          {/* Logo with beautiful multi-layer animations */}
          <div className="relative mb-4 group">
            {/* Outer orbiting particles */}
            <div className="absolute inset-[-20px] w-[168px] h-[168px]">
              {[0, 60, 120, 180, 240, 300].map((degree) => (
                <div
                  key={degree}
                  className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 shadow-lg"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${degree}deg) translateX(80px) translateY(-50%)`,
                    animation: `orbit 12s linear infinite`,
                    animationDelay: `${degree * 33}ms`,
                    boxShadow: '0 0 10px rgba(34, 211, 238, 0.6)',
                  }}
                />
              ))}
            </div>
            
            {/* Outer glowing ring - slow rotation */}
            <div 
              className="absolute inset-[-12px] w-[152px] h-[152px] rounded-full"
              style={{ 
                background: 'conic-gradient(from 0deg, transparent, rgba(34, 211, 238, 0.4), transparent, rgba(20, 184, 166, 0.4), transparent)',
                animation: 'spin 10s linear infinite',
              }} 
            />
            
            {/* Second ring - opposite rotation with dashed border */}
            <div 
              className="absolute inset-[-6px] w-[140px] h-[140px] rounded-full border-2 border-dashed border-cyan-300/50"
              style={{ animation: 'spin 15s linear infinite reverse' }} 
            />
            
            {/* Inner pulsing glow */}
            <div 
              className="absolute inset-0 w-[128px] h-[128px] rounded-full bg-gradient-to-br from-cyan-400/20 via-transparent to-teal-400/20"
              style={{ animation: 'pulse 3s ease-in-out infinite' }} 
            />
            
            {/* Shimmer effect overlay */}
            <div 
              className="absolute inset-0 w-[128px] h-[128px] rounded-full overflow-hidden"
            >
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full"
                style={{ animation: 'shimmer 3s ease-in-out infinite' }}
              />
            </div>
            
            {/* Logo container with hover effects */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-white to-slate-50 border-4 border-white flex items-center justify-center shadow-2xl overflow-hidden group-hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-all duration-500">
              <img 
                src={atefLogoIcon} 
                alt="جمعية عطف" 
                className="w-24 h-24 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" 
              />
            </div>
            
            {/* Floating decorative dots */}
            <div 
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 shadow-lg"
              style={{ animation: 'float 2s ease-in-out infinite' }} 
            />
            <div 
              className="absolute -bottom-2 left-1/4 w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500 shadow-lg"
              style={{ animation: 'float 2.5s ease-in-out infinite 0.5s' }} 
            />
            <div 
              className="absolute -bottom-2 right-1/4 w-2 h-2 rounded-full bg-gradient-to-r from-pink-400 to-rose-500 shadow-lg"
              style={{ animation: 'float 2s ease-in-out infinite 1s' }} 
            />
          </div>
          
          {/* Text under logo */}
          {!collapsed && (
            <div className="text-center">
              <img 
                src={atefLogoText} 
                alt="جمعية عطف للأيتام" 
                className="h-12 object-contain mx-auto hover:scale-105 transition-transform duration-300"
              />
              <p className="text-xs text-slate-500 mt-2 font-medium">نظام إدارة التسويق الإلكتروني</p>
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
