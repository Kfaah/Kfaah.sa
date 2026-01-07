import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import atefLogoIcon from "@/assets/atef-logo-icon-white.png";

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
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg",
          isActive
            ? "bg-gradient-to-r from-cyan-400 to-teal-400 text-white shadow-lg ring-2 ring-white"
            : "bg-white text-slate-700"
        )}
      >
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shadow-md",
          isActive ? "bg-white/20" : item.iconBg
        )}>
          <item.icon className="w-5 h-5 text-white" />
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
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Modern 3D Gradient Background with Geometric Pattern */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#3d9aa8] via-[#4A9BA8] to-[#2d7a85]" />
      
      {/* Animated Gradient Overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"
        style={{ animation: 'gradientShift 8s ease-in-out infinite alternate' }}
      />
      
      {/* Geometric Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      {/* 3D Light Effect - Top Highlight */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/15 to-transparent" />
      
      {/* 3D Depth Effect - Bottom Shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/20 to-transparent" />
      
      {/* Floating Orbs for Modern Effect */}
      <div 
        className="absolute top-1/4 right-4 w-32 h-32 rounded-full bg-white/5 blur-2xl"
        style={{ animation: 'float 6s ease-in-out infinite' }}
      />
      <div 
        className="absolute bottom-1/3 left-4 w-24 h-24 rounded-full bg-cyan-300/10 blur-xl"
        style={{ animation: 'float 8s ease-in-out infinite reverse' }}
      />
      
      {/* Shimmer Line Effect */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
        style={{ animation: 'shimmer 4s ease-in-out infinite' }}
      />
      
      {/* White Header Section with Logo */}
      <div className="relative z-10">
        {/* Circular border around logo area */}
        <div className="absolute inset-4 border-4 border-dashed border-cyan-300/50 rounded-full pointer-events-none" style={{ top: '10px', left: '10%', right: '10%', height: '200px' }} />
        
        {/* White curved background for logo */}
        <div className="bg-white rounded-b-[3rem] relative mx-2 shadow-lg">
          <div className="p-6 pb-10 flex flex-col items-center relative z-10">
            {/* Logo with zoom animation */}
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
              
              {/* Logo container with zoom animation and shimmer */}
              <div className="relative w-36 h-36 rounded-full bg-white border-4 border-white flex items-center justify-center shadow-xl overflow-hidden">
                <img 
                  src={atefLogoIcon} 
                  alt="جمعية عطف" 
                  className="w-28 h-28 object-contain"
                  style={{ animation: 'zoomPulse 4s ease-in-out infinite' }}
                />
                {/* Shimmer/Glow effect */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full"
                  style={{ animation: 'shimmer 3s ease-in-out infinite' }}
                />
              </div>
              
              {/* Decorative dot */}
              <div 
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-lg animate-bounce" 
                style={{ animationDuration: '2s' }} 
              />
            </div>
            
            {/* Text under logo */}
            {!collapsed && (
              <div className="text-center space-y-3">
                <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap tracking-wide">
                  جمعية عطف للأيتام
                </h1>
                <div className="relative">
                  <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-l from-cyan-600 via-teal-500 to-cyan-600">
                    نظام إدارة التسويق الإلكتروني
                  </p>
                  <div className="mt-2 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cyan Navigation Section */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10 pt-6">
        {/* User Profile Card - SEPARATED from logo */}
        {!collapsed && (
          <div className="mx-4 mb-4 flex-shrink-0 space-y-2">
            {/* Main Profile Card - Matching design */}
            <div className="bg-white rounded-2xl p-3 shadow-lg relative z-20">
              <div className="flex items-center gap-3">
                {/* Avatar - Left side, larger with cyan border */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-cyan-400 shadow-lg flex-shrink-0">
                  {user.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt="صورة المستخدم"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-xl font-bold text-white">
                      {user.firstName.charAt(0)}
                    </div>
                  )}
                </div>
                
                {/* Name and Role - Right side, centered vertically */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <h3 className="font-bold text-slate-800 text-base">{user.firstName} {user.lastName}</h3>
                  <span className="text-xs text-cyan-600 font-semibold bg-cyan-50 rounded-full px-3 py-1 border border-cyan-200 inline-flex items-center gap-1">
                    <span>%</span>
                    <span>{user.role}</span>
                  </span>
                </div>
              </div>
              </div>
            
            {/* Profile Icon Button */}
            <Link 
              to="/profile"
              className="w-full bg-white/90 hover:bg-white rounded-xl p-3 shadow-md flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-right">
                <span className="text-sm font-semibold text-slate-700">الملف الشخصي</span>
                <p className="text-xs text-slate-500">إدارة معلوماتك وصورتك</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
            </Link>
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
            {mainNavItems.map((item) => (
              <div key={item.href}>
                <NavLink item={item} />
              </div>
            ))}
            
            {/* Settings inside scroll */}
            <div className="pt-3 mt-3 border-t border-white/20">
              <NavLink item={settingsNavItem} />
            </div>
          </div>
        </nav>

        {/* Logout and Collapse Buttons */}
        <div className="p-3 border-t border-white/20 flex-shrink-0 space-y-2">
          {/* Logout Button */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="font-medium">تسجيل الخروج</span>}
          </button>

          {/* Collapse Button */}
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
