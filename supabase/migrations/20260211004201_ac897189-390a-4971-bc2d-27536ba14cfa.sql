
-- Create profile_prompts table for travel guide questions
CREATE TABLE public.profile_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_prompts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view profile prompts"
  ON public.profile_prompts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own prompts"
  ON public.profile_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts"
  ON public.profile_prompts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
  ON public.profile_prompts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_profile_prompts_user_id ON public.profile_prompts (user_id, display_order);
