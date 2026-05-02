import { ReactNode } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { OrgBrandingProvider } from "@/contexts/OrgBrandingContext";

export default function ProtectedAppProviders({ children }: { children: ReactNode }) {
  return (
    <OrganizationProvider>
      <OrgBrandingProvider>
        <UserProvider>{children}</UserProvider>
      </OrgBrandingProvider>
    </OrganizationProvider>
  );
}