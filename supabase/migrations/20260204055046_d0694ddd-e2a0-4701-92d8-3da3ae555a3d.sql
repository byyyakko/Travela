-- Add dietary options column to stores table
ALTER TABLE public.stores 
ADD COLUMN dietary_options text[] DEFAULT '{}'::text[];