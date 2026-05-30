import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/dataClient";

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

      const pendingDataStr = sessionStorage.getItem("pendingMerchantData");
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
        let existingStore: { id: string } | null = null;
        try {
          existingStore = await apiGet<{ id: string }>("/stores/me");
        } catch {
          existingStore = null;
        }

        if (existingStore) {
          // Store already created, clean up and redirect
          sessionStorage.removeItem("pendingMerchantData");
          sessionStorage.removeItem("selectedRole");
          setSetupComplete(true);
          navigate("/merchant-dashboard");
          return;
        }

        // Create the store
        await apiPost("/stores", {
          store_name: pendingData.storeName,
          store_type: pendingData.storeType,
          phone: pendingData.phone,
          address: pendingData.address,
        });

        // Assign merchant role
        try {
          await apiPost("/profiles/me/roles", { role: "merchant" });
        } catch (roleErr: any) {
          if (!String(roleErr?.message ?? "").includes("duplicate")) {
            throw roleErr;
          }
        }

        // Clean up and redirect
        sessionStorage.removeItem("pendingMerchantData");
        sessionStorage.removeItem("selectedRole");

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
