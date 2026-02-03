import { useEffect } from "react";
import { useMerchantSetup } from "@/hooks/useMerchantSetup";

/**
 * This component runs the merchant setup logic when a user
 * verifies their email and returns to the app.
 * It should be rendered inside the router context.
 */
const MerchantSetupHandler = ({ children }: { children: React.ReactNode }) => {
  const { isSettingUp } = useMerchantSetup();

  if (isSettingUp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 to-pink-100">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-pink-600 font-medium">Setting up your store...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default MerchantSetupHandler;
