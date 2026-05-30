import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailBanned } from "@/lib/moderationClient";
import { apiGet, apiPost } from "@/lib/dataClient";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isMerchant: boolean;
  checkMerchantStatus: () => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMerchant, setIsMerchant] = useState(false);

  const checkMerchantStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const roles = await apiGet<string[]>("/profiles/me/roles");
      const hasMerchantRole = roles.includes("merchant");
      setIsMerchant(hasMerchantRole);
      return hasMerchantRole;
    } catch {
      return false;
    }
  }, [user]);

  useEffect(() => {
    // Initialise from persisted session immediately (prevents flash of unauth UI)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      checkMerchantStatus();
    } else {
      setIsMerchant(false);
    }
  }, [user, checkMerchantStatus]);

  const signUp = async (email: string, password: string) => {
    // Fail-open: if the banned-email check times out (cold backend), allow sign-up to proceed
    let banned = false;
    try {
      banned = await Promise.race([
        checkEmailBanned(email),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
      ]);
    } catch (err) {
      console.error("[AuthContext] checkEmailBanned failed, failing open:", err);
      banned = false;
    }
    if (banned) {
      return { error: new Error("This account has been suspended. You cannot register with this email.") };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/email-verified`,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session) {
      apiPost("/profiles/auth/link", { email }).catch((err: unknown) =>
        console.warn("[AuthContext] auth/link failed:", err)
      );
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsMerchant(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, isMerchant, checkMerchantStatus, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
