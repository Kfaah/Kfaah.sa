import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Settings as SettingsIcon,
  Brain,
  ShieldCheck,
  Palette,
  LayoutGrid,
  Bell,
  Database,
  Image as ImageIcon,
  FileDown,
  Users2,
  HardDriveUpload,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOrgPrivilegeFlags } from "@/lib/orgAuthorization";
import { cn } from "@/lib/utils";

type Tile = {
  key: string;
  to: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  requiresAdmin?: boolean;
  requiresSuperAdmin?: boolean;
};

const tiles: Tile[] = [
  {
    key: "roles",
    to: "roles-permissions",
    label: "الأدوار والصلاحيات",
    description: "تحكم بدقة فيمن يستطيع رؤية وإنشاء وتعديل وحذف كل وحدة",
    icon: ShieldCheck,
    gradient: "from-emerald-500 to-teal-500",
    requiresAdmin: true,
  },
  {
    key: "member-roles",
    to: "member-roles",
    label: "صلاحيات الأعضاء",
    description: "عيّن لكل موظف صلاحيته: مدير نظام، مدير جمعية، مدير قسم أو موظف",
    icon: UserCog,
    gradient: "from-indigo-500 to-blue-600",
    requiresAdmin: true,
  },
  {
    key: "branding",
    to: "branding",
    label: "هوية الجمعية",
    description: "اسم الموقع، الشعار، الألوان والشعار النصي",
    icon: Palette,
    gradient: "from-pink-500 to-rose-500",
    requiresAdmin: true,
  },
  {
    key: "navigation",
    to: "navigation",
    label: "الأيقونات والقوائم",
    description: "ترتيب وإخفاء وإعادة تسمية أيقونات الشريط الجانبي",
    icon: LayoutGrid,
    gradient: "from-amber-500 to-orange-500",
    requiresAdmin: true,
  },
  {
    key: "intelligence",
    to: "intelligence-profile",
    label: "أسئلة الملف الذكي",
    description: "تخصيص أسئلة وخيارات الملف الذكي للموظف",
    icon: Brain,
    gradient: "from-violet-500 to-fuchsia-500",
    requiresAdmin: true,
  },
  {
    key: "welcome",
    to: "welcome",
    label: "شاشة الترحيب",
    description: "إدارة خلفيات وعبارات شاشة الترحيب",
    icon: ImageIcon,
    gradient: "from-purple-500 to-indigo-500",
    requiresAdmin: true,
  },
  {
    key: "members",
    to: "members",
    label: "أعضاء الجمعية",
    description: "مراجعة طلبات الانضمام واعتماد العضويات",
    icon: Users2,
    gradient: "from-sky-500 to-blue-500",
    requiresAdmin: true,
  },
  {
    key: "exports",
    to: "exports",
    label: "التصدير والملفات",
    description: "ملفات تقديم المشروع للمانحين وتصدير البيانات",
    icon: FileDown,
    gradient: "from-cyan-500 to-teal-500",
    requiresAdmin: true,
  },
  {
    key: "notifications",
    to: "notifications",
    label: "الإشعارات",
    description: "تخصيص قواعد التنبيهات والتذكيرات",
    icon: Bell,
    gradient: "from-blue-500 to-cyan-500",
    requiresAdmin: true,
  },
  {
    key: "security",
    to: "security",
    label: "الأمان والخصوصية",
    description: "كلمات المرور، الجلسات وسجل الدخول",
    icon: Database,
    gradient: "from-slate-600 to-zinc-700",
    requiresAdmin: true,
  },
  {
    key: "backup",
    to: "backup",
    label: "النسخ الاحتياطي",
    description: "نسخ يومية تلقائية لقاعدة البيانات إلى GitHub",
    icon: HardDriveUpload,
    gradient: "from-green-600 to-emerald-700",
    requiresAdmin: true,
  },
];

export default function SettingsHub() {
  const { slug } = useParams<{ slug?: string }>();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const flags = await getOrgPrivilegeFlags(
        user.id,
        currentOrg?.id,
      );
      setIsSuper(flags.isSuperAdmin);
      setIsAdmin(
        flags.isSuperAdmin ||
        flags.isOrgAdmin ||
        flags.isModerator,
      );
    };
    load();
  }, [user, currentOrg?.id]);

  const base = slug ? `/${slug}/settings` : "/settings";

  const visibleTiles = tiles.filter((t) => {
    if (t.requiresSuperAdmin) return isSuper;
    if (t.requiresAdmin) return isAdmin;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-8" dir="rtl">
        <PageHeader
          icon={<SettingsIcon className="w-6 h-6" />}
          title="الإعدادات"
          subtitle="تحكم كامل في هوية الموقع، الأدوار، والمحتوى"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {visibleTiles.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.key}
                to={`${base}/${t.to}`}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border bg-card p-5",
                  "hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
                  "flex flex-col items-start gap-3 min-h-[160px]"
                )}
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center",
                    "bg-gradient-to-br shadow-lg",
                    t.gradient
                  )}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    {t.label}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {!isAdmin && (
          <p className="text-sm text-muted-foreground text-center py-8">
            لا توجد إعدادات متاحة لحسابك حالياً.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}