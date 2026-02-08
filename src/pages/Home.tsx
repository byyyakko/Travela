import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import CutesyHome from "@/components/home/CutesyHome";
import { useAnalytics } from "@/hooks/useAnalytics";

const Home = () => {
  const { user } = useAuth();
  useAnalytics("home");

  // Fetch user profile for display name
  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name || undefined;

  return (
    <AppLayout>
      <CutesyHome displayName={displayName} />
    </AppLayout>
  );
};

export default Home;
