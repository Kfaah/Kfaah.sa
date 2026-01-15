import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Users,
  UserCog,
  Clock,
  FolderOpen,
  PieChart,
  ArrowLeft,
  Briefcase,
  TrendingUp,
  CalendarDays,
  FileCheck,
} from "lucide-react";
import { HRNavigationIcons, type HRSection } from "@/components/hr/HRNavigationIcons";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface HRModuleCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  iconBg: string;
  stats?: {
    label: string;
    value: string | number;
  };
}

const hrModules: HRModuleCard[] = [
  {
    title: "الموظفين",
    description: "إدارة بيانات الموظفين والملفات الشخصية",
    icon: Users,
    href: "/employees",
    gradient: "from-[#3d9aa8] to-[#2d7a85]",
    iconBg: "bg-[#3d9aa8]/20",
    stats: { label: "إجمالي الموظفين", value: "24" }
  },
  {
    title: "الأدوار والصلاحيات",
    description: "إدارة صلاحيات المستخدمين والأدوار الوظيفية",
    icon: UserCog,
    href: "/roles",
    gradient: "from-indigo-500 to-indigo-600",
    iconBg: "bg-indigo-500/20",
    stats: { label: "الأدوار النشطة", value: "5" }
  },
  {
    title: "سجلات الحضور",
    description: "متابعة حضور وانصراف الموظفين",
    icon: Clock,
    href: "/attendance-management",
    gradient: "from-emerald-500 to-emerald-600",
    iconBg: "bg-emerald-500/20",
    stats: { label: "الحضور اليوم", value: "18" }
  },
  {
    title: "الطلبات",
    description: "إدارة طلبات الإجازات والاستئذان",
    icon: FolderOpen,
    href: "/hr-requests",
    gradient: "from-amber-500 to-amber-600",
    iconBg: "bg-amber-500/20",
    stats: { label: "طلبات معلقة", value: "7" }
  },
  {
    title: "التقارير والإحصائيات",
    description: "تقارير شاملة وإحصائيات الموارد البشرية",
    icon: PieChart,
    href: "/hr-reports",
    gradient: "from-cyan-500 to-cyan-600",
    iconBg: "bg-cyan-500/20",
    stats: { label: "تقارير الشهر", value: "12" }
  },
  {
    title: "قوالب الطلبات",
    description: "إعداد وتخصيص نماذج الطلبات الرسمية",
    icon: FileCheck,
    href: "/hr-templates",
    gradient: "from-[#3d9aa8] to-[#2d7a85]",
    iconBg: "bg-[#3d9aa8]/20",
    stats: { label: "القوالب", value: "8" }
  },
];

export default function HR() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<HRSection>("my-requests");

  // التحقق من صلاحيات المستخدم
  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data?.map((r) => r.role) || [];
    },
    enabled: !!user?.id,
  });

  const isAdmin = userRoles.includes("admin");
  const isHRManager = userRoles.includes("hr_manager");
  const hasAdminAccess = isAdmin || isHRManager;

  // تعيين القسم الافتراضي حسب نوع المستخدم
  useEffect(() => {
    if (hasAdminAccess) {
      setActiveSection("all-requests");
    } else {
      setActiveSection("my-requests");
    }
  }, [hasAdminAccess]);

  const handleSectionChange = (section: HRSection) => {
    setActiveSection(section);
    navigate(`/hr-requests?section=${section}`);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#3d9aa8]/5 p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3d9aa8] to-[#2d7a85] flex items-center justify-center shadow-xl shadow-[#3d9aa8]/30">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">الموارد البشرية</h1>
              <p className="text-slate-500 mt-1">إدارة شؤون الموظفين والطلبات</p>
            </div>
          </div>

          {/* أيقونات الطلبات (تظهر لكل الحسابات) */}
          <div className="mt-6">
            <HRNavigationIcons
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
              pendingApprovalsCount={0}
              approvalsHistoryCount={0}
            />
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#3d9aa8]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#3d9aa8]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">24</p>
                  <p className="text-xs text-slate-500">موظف</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#3d9aa8]/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#3d9aa8]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">92%</p>
                  <p className="text-xs text-slate-500">نسبة الحضور</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#3d9aa8]/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-[#3d9aa8]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">7</p>
                  <p className="text-xs text-slate-500">طلب معلق</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#3d9aa8]/10 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-[#3d9aa8]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">15</p>
                  <p className="text-xs text-slate-500">إجازة هذا الشهر</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hrModules.map((module) => (
            <Link
              key={module.href}
              to={module.href}
              className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              {/* Gradient Top Border */}
              <div className={cn(
                "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
                module.gradient
              )} />

              {/* Card Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  {/* Icon */}
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                    "bg-gradient-to-br",
                    module.gradient
                  )}>
                    <module.icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Arrow */}
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <ArrowLeft className="w-4 h-4 text-slate-600" />
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-[#3d9aa8] transition-colors">
                  {module.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {module.description}
                </p>

                {/* Stats */}
                {module.stats && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{module.stats.label}</span>
                      <span className={cn(
                        "text-lg font-bold bg-gradient-to-r bg-clip-text text-transparent",
                        module.gradient
                      )}>
                        {module.stats.value}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Hover Overlay */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity",
                module.gradient
              )} />
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}