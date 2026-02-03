-- Create user subscription tier enum
CREATE TYPE public.user_subscription_tier AS ENUM ('tier_0', 'tier_1', 'tier_2');

-- Add subscription tier to profiles table
ALTER TABLE public.profiles 
ADD COLUMN subscription_tier public.user_subscription_tier NOT NULL DEFAULT 'tier_0';