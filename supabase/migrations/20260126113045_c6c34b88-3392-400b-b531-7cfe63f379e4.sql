-- Add age and matching preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN date_of_birth DATE,
ADD COLUMN min_age_preference INTEGER DEFAULT 18 CHECK (min_age_preference >= 18),
ADD COLUMN max_age_preference INTEGER DEFAULT 99 CHECK (max_age_preference >= 18);

-- Add constraint to ensure min <= max
ALTER TABLE public.profiles 
ADD CONSTRAINT age_preference_range CHECK (min_age_preference <= max_age_preference);