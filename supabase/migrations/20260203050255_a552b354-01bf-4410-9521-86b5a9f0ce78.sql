-- Create store type enum
CREATE TYPE public.store_type AS ENUM ('attractions', 'food', 'entertainment');

-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('tier_0', 'tier_1', 'tier_2');

-- Add store_type and subscription_tier columns to stores table
ALTER TABLE public.stores 
ADD COLUMN store_type public.store_type NOT NULL DEFAULT 'food',
ADD COLUMN subscription_tier public.subscription_tier NOT NULL DEFAULT 'tier_0';

-- Create table to track store visits/analytics
CREATE TABLE public.store_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  visitor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  visitor_country TEXT,
  page_viewed TEXT DEFAULT 'profile'
);

-- Enable RLS on store_visits
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

-- Policy: Store owners can view visits to their store
CREATE POLICY "Store owners can view their visits"
ON public.store_visits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = store_visits.store_id
    AND stores.user_id = auth.uid()
  )
);

-- Policy: Anyone can insert a visit (when viewing a store)
CREATE POLICY "Anyone can record visits"
ON public.store_visits
FOR INSERT
WITH CHECK (true);