import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import CutesyHome from "@/components/home/CutesyHome";
import MinimalistHome from "@/components/home/MinimalistHome";
import AnimeHome from "@/components/home/AnimeHome";

const Home = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

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

  // Render theme-specific home layouts
  const renderHomeContent = () => {
    switch (theme) {
      case "cutesy":
        return <CutesyHome displayName={displayName} />;
      case "anime":
        return <AnimeHome displayName={displayName} />;
      default:
        return <MinimalistHome displayName={displayName} />;
    }
  };

  return (
    <AppLayout>
      {renderHomeContent()}
    </AppLayout>
  );
};

export default Home;
