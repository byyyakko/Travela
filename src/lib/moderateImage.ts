import { supabase, supabaseLovable } from "@/integrations/supabase/client";

interface ModerationResult {
  is_safe: boolean;
  is_nsfw: boolean;
  is_vulgar: boolean;
  is_ai_generated: boolean;
  confidence: number;
  reason: string;
}

/**
 * Upload a file to storage, get its public URL, moderate it, and return the result.
 * If moderation fails or image is unsafe, the uploaded file is removed.
 * Returns { publicUrl, moderation } on success, or throws with a user-friendly message.
 */
export const uploadAndModerate = async (
  bucket: string,
  fileName: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<{ publicUrl: string; moderation: ModerationResult }> => {
  // 1. Upload the file
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, options);

  if (uploadError) throw uploadError;

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  // 3. Moderate the image
  try {
    const { data: modResult, error: modError } = await supabaseLovable.functions.invoke(
      "moderate-image",
      { body: { image_url: publicUrl } }
    );

    if (modError) {
      console.error("Moderation invocation failed:", modError);
      await supabase.storage.from(bucket).remove([fileName]);
      throw new Error("Image moderation is currently unavailable. Please try again.");
    }

    const result = modResult as ModerationResult;

    // Block NSFW or vulgar content
    if (result.is_nsfw || result.is_vulgar || !result.is_safe) {
      // Remove the uploaded file
      await supabase.storage.from(bucket).remove([fileName]);
      const reason = result.reason || "This image was flagged as inappropriate and cannot be uploaded.";
      throw new Error(reason);
    }

    return { publicUrl, moderation: result };
  } catch (err: any) {
    // If it's our own thrown error from moderation rejection, always re-throw
    if (err instanceof Error && err.message && err.message !== "Moderation error") {
      // Check if it came from our moderation block (not a network/service error)
      const isServiceError = err.message === "Failed to fetch" || err.message?.includes("NetworkError") || err.message?.includes("TypeError");
      if (!isServiceError) {
        throw err;
      }
    }
    // Moderation service failed — fail closed, reject the image
    console.error("Moderation service error, rejecting image:", err);
    await supabase.storage.from(bucket).remove([fileName]);
    throw new Error("Image moderation failed. Please try again.");
  }
};
