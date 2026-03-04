-- Add image_urls column for multi-image posts
ALTER TABLE public.posts ADD COLUMN image_urls text[] DEFAULT '{}'::text[];