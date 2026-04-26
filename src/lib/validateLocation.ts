import { utilGeocode } from "@/lib/aiClient";

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
    const data = await utilGeocode(location.trim());

    if (data.error) {
      console.error("Location validation error:", data.error);
      return { valid: true };
    }

    if (data?.latitude && data?.longitude) {
      return { valid: true, formattedAddress: data.formattedAddress ?? undefined };
    }

    return { valid: false };
  } catch {
    // Fail open on network errors
    return { valid: true };
  }
};
