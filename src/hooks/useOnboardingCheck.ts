import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useOnboardingCheck = () => {
  const { user } = useAuth();

  const { data: needsOnboarding, isLoading } = useQuery({
    queryKey: ["onboarding-check", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio, interests, location")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // User needs onboarding if they haven't filled out basic profile info
      if (!data) return true;
      
      // Check if profile is essentially empty (new user)
      const hasBasicInfo = data.display_name || data.bio || 
        (data.interests && data.interests.length > 0) || data.location;
      
      return !hasBasicInfo;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { needsOnboarding: needsOnboarding ?? false, isLoading };
};
