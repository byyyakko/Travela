
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Merchants can upload store item images" ON storage.objects;
DROP POLICY IF EXISTS "Merchants can update their store item images" ON storage.objects;
DROP POLICY IF EXISTS "Merchants can delete their store item images" ON storage.objects;

-- Recreate with proper ownership checks
CREATE POLICY "Merchants can upload store item images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'store-items' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Merchants can update their store item images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'store-items' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Merchants can delete their store item images"
ON storage.objects FOR DELETE
USING (bucket_id = 'store-items' AND auth.uid()::text = (storage.foldername(name))[1]);
