-- Add address and coordinates to stores table for map display
ALTER TABLE public.stores 
ADD COLUMN address text,
ADD COLUMN latitude double precision,
ADD COLUMN longitude double precision;