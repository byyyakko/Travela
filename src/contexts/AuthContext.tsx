import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkEmailBanned } from "@/lib/moderationClient";

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

  const checkMerchantStatus = async (): Promise<boolean> => {
    if (!user) return false;
    
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "merchant")
      .maybeSingle();
    
    const hasMerchantRole = !!data;
    setIsMerchant(hasMerchantRole);
    return hasMerchantRole;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Check merchant status when user changes
  useEffect(() => {
    if (user) {
      checkMerchantStatus();
    } else {
      setIsMerchant(false);
    }
  }, [user]);

  const signUp = async (email: string, password: string) => {
    const banned = await checkEmailBanned(email);
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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
