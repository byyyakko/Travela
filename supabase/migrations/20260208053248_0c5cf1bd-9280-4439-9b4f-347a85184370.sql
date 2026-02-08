
-- Tighten store_visits INSERT: require visitor_user_id to match auth.uid() when provided
DROP POLICY IF EXISTS "Authenticated users can record visits" ON public.store_visits;
CREATE POLICY "Authenticated users can record visits"
ON public.store_visits
FOR INSERT
TO authenticated
WITH CHECK (
  visitor_user_id IS NULL OR visitor_user_id = auth.uid()
);
