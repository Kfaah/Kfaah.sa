import { useEffect, useLayoutEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";

/**
 * /demo — entry point for the public demo organization.
 * Runs the setup-demo edge function (idempotent), signs the visitor in
 * with the read-only demo viewer account, then redirects to the demo
 * organization's dashboard.
 */
export default function Demo() {
  useLayoutEffect(() => {
    const gate = document.getElementById("__branding_gate__");
    if (gate?.parentNode) gate.parentNode.removeChild(gate);
    document.body.style.visibility = "";
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // If already signed in as the demo viewer, skip the heavy setup call.
        const { data: sessionData } = await supabase.auth.getSession();
        const currentEmail = sessionData?.session?.user?.email?.toLowerCase();
        if (currentEmail === "111111111@user.local") {
          return;
        }

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
  }, []);

  return (
    <DashboardLayout>
      <WelcomeScreen />
    </DashboardLayout>
  );
}
