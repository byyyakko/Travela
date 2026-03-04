
-- Add accepted column to conversations (null = pending request, true = accepted, false = declined)
ALTER TABLE public.conversations ADD COLUMN accepted boolean DEFAULT null;

-- For existing conversations (from mutual matches), mark as accepted
UPDATE public.conversations SET accepted = true;

-- Add a declined_at timestamp so we know when it was declined
ALTER TABLE public.conversations ADD COLUMN declined_at timestamp with time zone DEFAULT null;
