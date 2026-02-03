import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface PendingMerchantData {
  storeName: string;
  storeType: "attractions" | "food" | "entertainment";
  phone: string | null;
  address: string | null;
}

/**
 * Hook that checks if a logged-in user has pending merchant data
 * and automatically sets up their store + role if so.
 */
export const useMerchantSetup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    const setupMerchantAccount = async () => {
      if (!user) return;

      const pendingDataStr = localStorage.getItem("pendingMerchantData");
      if (!pendingDataStr) {
        setSetupComplete(true);
        return;
      }

      // Don't run setup if we're already on the merchant dashboard
      if (location.pathname.startsWith("/merchant-dashboard")) {
        return;
      }

      setIsSettingUp(true);

      try {
        const pendingData: PendingMerchantData = JSON.parse(pendingDataStr);

        // Check if store already exists
        const { data: existingStore } = await supabase
          .from("stores")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (existingStore) {
          // Store already created, clean up and redirect
          localStorage.removeItem("pendingMerchantData");
          localStorage.removeItem("selectedRole");
          setSetupComplete(true);
          navigate("/merchant-dashboard");
          return;
        }

        // Create the store
        const { error: storeError } = await supabase.from("stores").insert({
          user_id: user.id,
          store_name: pendingData.storeName,
          store_type: pendingData.storeType,
          phone: pendingData.phone,
          address: pendingData.address,
        });

        if (storeError) throw storeError;

        // Assign merchant role
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: user.id,
          role: "merchant",
        });

        if (roleError && !roleError.message.includes("duplicate")) {
          throw roleError;
        }

        // Clean up and redirect
        localStorage.removeItem("pendingMerchantData");
        localStorage.removeItem("selectedRole");

        toast({
          title: "Welcome aboard! 🎉",
          description: "Your merchant account is ready.",
        });

        setSetupComplete(true);
        navigate("/merchant-dashboard");
      } catch (error: any) {
        console.error("Error setting up merchant:", error);
        toast({
          title: "Setup failed",
          description: error.message || "Could not complete merchant setup.",
          variant: "destructive",
        });
        setSetupComplete(true);
      } finally {
        setIsSettingUp(false);
      }
    };

    setupMerchantAccount();
  }, [user, navigate, location.pathname]);

  return { isSettingUp, setupComplete };
};
