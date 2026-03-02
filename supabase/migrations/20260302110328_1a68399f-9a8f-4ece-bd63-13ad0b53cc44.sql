
-- Add activity vibe and time availability preferences to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activity_vibe text DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS time_availability text[] DEFAULT '{}'::text[];
