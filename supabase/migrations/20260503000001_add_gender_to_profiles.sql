ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT
    CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS same_gender_only BOOLEAN NOT NULL DEFAULT FALSE;
