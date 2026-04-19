import { Building2, Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

export function OrganizationSwitcher({ collapsed }: Props) {
  const { currentOrg, availableOrgs, isSuperAdmin, switchOrg, loading } = useOrganization();
  const navigate = useNavigate();

  if (loading || !currentOrg) return null;
  // Don't show switcher when there's only one org and user is not super_admin
  if (!isSuperAdmin && availableOrgs.length <= 1) return null;

  return (
    <div className="mx-4 mb-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-2 bg-white/95 hover:bg-white rounded-xl p-2.5 shadow-md transition-all group",
              collapsed && "justify-center"
            )}
            title={currentOrg.name}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow flex-shrink-0 overflow-hidden">
              {currentOrg.logo_url ? (
                <img src={currentOrg.logo_url} alt={currentOrg.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-4 h-4 text-white" />
              )}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 text-right min-w-0">
                  <p className="text-[10px] text-slate-500 font-medium leading-tight">الجمعية الحالية</p>
                  <p className="text-sm font-bold text-slate-800 truncate leading-tight">{currentOrg.name}</p>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors flex-shrink-0" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" side="left" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            تبديل الجمعية ({availableOrgs.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto">
            {availableOrgs.map((org) => {
              const active = org.id === currentOrg.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onSelect={() => switchOrg(org.id)}
                  className="gap-2 cursor-pointer py-2"
                >
                  <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{org.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {org.is_active ? "نشطة" : "موقوفة"} · {org.subscription_tier}
                    </p>
                  </div>
                  {active && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </div>

          {isSuperAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => navigate("/organizations")}
                className="gap-2 cursor-pointer text-primary font-semibold"
              >
                <Settings2 className="w-4 h-4" />
                إدارة الجمعيات
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
