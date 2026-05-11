import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Ignore TOKEN_REFRESHED / USER_UPDATED that happen when the tab regains
        // focus — they cause a full app re-render that feels like a reload.
        // Only react when the actual user identity changes.
        setSession((prev) => {
          const sameUser = prev?.user?.id === newSession?.user?.id;
          if (sameUser && event !== "SIGNED_OUT" && event !== "SIGNED_IN") {
            return prev;
          }
          return newSession;
        });
        setUser((prev) => {
          const nextUser = newSession?.user ?? null;
          if (prev?.id === nextUser?.id && event !== "SIGNED_OUT" && event !== "SIGNED_IN") {
            return prev;
          }
          return nextUser;
        });
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Sometimes the server-side session is already gone (e.g. after magic-link/impersonation),
    // which can make global logout fail. In that case we still must clear local state.
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
    }

    // Force-clear any persisted auth tokens so routing stops treating the user as logged-in.
    try {
      const storageKey = (supabase.auth as any)?.storageKey as string | undefined;
      if (storageKey) localStorage.removeItem(storageKey);

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.includes("auth-token")) localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }

    // Force-update app state even if onAuthStateChange doesn't fire.
    setSession(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
