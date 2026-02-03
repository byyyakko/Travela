-- Create store_items table for merchant products/menu items
CREATE TABLE public.store_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  -- For food stores: ordering tip
  ordering_tip TEXT,
  -- For attractions/entertainment: price info
  price TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own items
CREATE POLICY "Merchants can view their store items"
ON public.store_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_items.store_id 
    AND stores.user_id = auth.uid()
  )
);

-- Merchants can create items for their store
CREATE POLICY "Merchants can create store items"
ON public.store_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_items.store_id 
    AND stores.user_id = auth.uid()
  )
);

-- Merchants can update their store items
CREATE POLICY "Merchants can update their store items"
ON public.store_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_items.store_id 
    AND stores.user_id = auth.uid()
  )
);

-- Merchants can delete their store items
CREATE POLICY "Merchants can delete their store items"
ON public.store_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.stores 
    WHERE stores.id = store_items.store_id 
    AND stores.user_id = auth.uid()
  )
);

-- Public can view all store items (for travelers browsing)
CREATE POLICY "Anyone can view store items"
ON public.store_items
FOR SELECT
USING (true);

-- Create storage bucket for store item images
INSERT INTO storage.buckets (id, name, public) VALUES ('store-items', 'store-items', true);

-- Storage policies for store item images
CREATE POLICY "Anyone can view store item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-items');

CREATE POLICY "Merchants can upload store item images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'store-items' AND auth.uid() IS NOT NULL);

CREATE POLICY "Merchants can update their store item images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'store-items' AND auth.uid() IS NOT NULL);

CREATE POLICY "Merchants can delete their store item images"
ON storage.objects FOR DELETE
USING (bucket_id = 'store-items' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_store_items_updated_at
BEFORE UPDATE ON public.store_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();