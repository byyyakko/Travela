-- Add description and website_url columns to stores table
ALTER TABLE public.stores ADD COLUMN description text;
ALTER TABLE public.stores ADD COLUMN website_url text;

-- Create store_images table for multiple store photos
CREATE TABLE public.store_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view store images
CREATE POLICY "Anyone can view store images"
  ON public.store_images
  FOR SELECT
  USING (true);

-- Merchants can manage their store images
CREATE POLICY "Merchants can insert their store images"
  ON public.store_images
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = store_images.store_id AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their store images"
  ON public.store_images
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = store_images.store_id AND stores.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can delete their store images"
  ON public.store_images
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM stores WHERE stores.id = store_images.store_id AND stores.user_id = auth.uid()
  ));