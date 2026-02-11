import { supabase } from "@/integrations/supabase/client";

/**
 * Validate that a location string refers to a real place using geocoding.
 * Returns the formatted address if valid, or null if the place doesn't exist.
 */
export const validateRealLocation = async (
  location: string
): Promise<{ valid: boolean; formattedAddress?: string }> => {
  if (!location || location.trim().length === 0) {
    return { valid: false };
  }

  try {
    const { data, error } = await supabase.functions.invoke("geocode-address", {
      body: { address: location.trim() },
    });

    if (error) {
      console.error("Location validation error:", error);
      // Fail open if the service is down
      return { valid: true };
    }

    if (data?.latitude && data?.longitude) {
      return { valid: true, formattedAddress: data.formattedAddress };
    }

    return { valid: false };
  } catch {
    // Fail open on network errors
    return { valid: true };
  }
};
