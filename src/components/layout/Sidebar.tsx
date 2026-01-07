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
  { title: "نظرة عامة", href: "/", icon: LayoutDashboard, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "الموظفين", href: "/employees", icon: Users, iconBg: "bg-gradient-to-br from-rose-400 to-rose-500" },
  { title: "الأدوار والصلاحيات", href: "/roles", icon: UserCog, iconBg: "bg-gradient-to-br from-orange-400 to-orange-500" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, badge: 18, iconBg: "bg-gradient-to-br from-blue-400 to-blue-500" },
  { title: "الخطط", href: "/plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-rose-300 to-rose-400" },
  { title: "التقارير", href: "/reports", icon: BarChart3, iconBg: "bg-gradient-to-br from-violet-400 to-violet-500" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconBg: "bg-gradient-to-br from-pink-400 to-pink-500" },
  { title: "المراسلات", href: "/messages", icon: MessageSquare, badge: 5, iconBg: "bg-gradient-to-br from-amber-400 to-amber-500" },
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
          "flex items-center gap-3 px-3 py-2.5 rounded-full transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-cyan-400 to-cyan-500 text-white shadow-lg shadow-cyan-200"
            : "bg-white text-slate-700 hover:shadow-md border border-slate-100"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shadow-sm",
          isActive ? "bg-white/25" : item.iconBg
        )}>
          <item.icon className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <>
            <span className={cn(
              "font-semibold text-sm flex-1",
              isActive ? "text-white" : "text-slate-700"
            )}>
              {item.title}
            </span>
            {item.badge && (
              <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full",
                isActive ? "bg-white/25 text-white" : "bg-rose-100 text-rose-600"
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
        "bg-gradient-to-b from-cyan-100 via-cyan-200 to-cyan-300",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Logo Section */}
      <div className="p-4 flex flex-col items-center">
        <div className="relative mb-3">
          {/* Animated ring */}
          <div 
            className="absolute inset-[-6px] rounded-full border-[3px] border-cyan-400/50 border-t-cyan-500 animate-spin" 
            style={{ animationDuration: '8s' }} 
          />
          
          {/* Logo container */}
          <div className="relative w-20 h-20 rounded-full bg-white border-4 border-cyan-300/50 flex items-center justify-center shadow-lg overflow-hidden">
            <img 
              src={atefLogoIcon} 
              alt="جمعية عطف" 
              className="w-14 h-14 object-contain" 
            />
          </div>
        </div>
        
        {/* Text under logo */}
        {!collapsed && (
          <div className="text-center">
            <img 
              src={atefLogoText} 
              alt="جمعية عطف للأيتام" 
              className="h-10 object-contain mx-auto"
            />
            <p className="text-[10px] text-cyan-700 mt-1 font-medium">نظام إدارة التسويق الإلكتروني</p>
          </div>
        )}
      </div>

      {/* User Profile Card */}
      {!collapsed && (
        <div className="mx-3 mb-3 bg-white rounded-2xl p-3 shadow-md border border-cyan-100">
          <div className="flex items-center gap-3 flex-row-reverse">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-lg font-bold text-white shadow-md">
              ج
            </div>
            <div className="text-right flex-1">
              <h3 className="font-bold text-slate-800 text-sm">جابر الحريصي</h3>
              <div className="flex items-center gap-1 justify-end mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] text-cyan-600 font-medium border border-cyan-200 rounded-full px-2 py-0.5">
                  % مدير النظام
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-2 overflow-y-auto pb-2">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Settings & Collapse */}
      <div className="p-3 space-y-2">
        <NavLink item={settingsNavItem} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-full bg-white/50 text-cyan-700 hover:bg-white transition-colors text-sm"
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
    </aside>
  );
}
