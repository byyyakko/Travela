
-- Table to store past AI itinerary generations
CREATE TABLE public.itinerary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  title text NOT NULL,
  itinerary_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.itinerary_history ENABLE ROW LEVEL SECURITY;

-- Users can only access their own history
CREATE POLICY "Users can view their own history"
ON public.itinerary_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
ON public.itinerary_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history"
ON public.itinerary_history FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history"
ON public.itinerary_history FOR DELETE
USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_itinerary_history_updated_at
BEFORE UPDATE ON public.itinerary_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast user lookups
CREATE INDEX idx_itinerary_history_user_id ON public.itinerary_history (user_id, created_at DESC);
