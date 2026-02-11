
-- Create profile_photos table for multiple profile photos (up to 6)
CREATE TABLE public.profile_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view profile photos"
  ON public.profile_photos FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own photos"
  ON public.profile_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos"
  ON public.profile_photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON public.profile_photos FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_profile_photos_user_id ON public.profile_photos (user_id, display_order);
