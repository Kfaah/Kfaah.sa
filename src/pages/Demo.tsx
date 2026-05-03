import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { DemoModeShell } from "@/components/demo/DemoModeShell";

/**
 * /demo — entry point for the public demo organization.
 * Runs the setup-demo edge function (idempotent), signs the visitor in
 * with the read-only demo viewer account, then redirects to the demo
 * organization's dashboard.
 */
export default function Demo() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("setup-demo", {
          body: {},
        });
        if (fnErr) throw fnErr;
        if (!data?.email || !data?.password) throw new Error("invalid_response");

        await supabase.auth.signOut().catch(() => {});
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signErr) throw signErr;
      } catch (e) {
        console.error("Demo init failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <DemoModeShell>
      <DashboardLayout>
        <WelcomeScreen />
      </DashboardLayout>
    </DemoModeShell>
  );
}
