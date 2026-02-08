
-- 1. FIX CRITICAL: Restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. FIX CRITICAL: Restrict stores SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can view all stores" ON public.stores;
CREATE POLICY "Authenticated users can view stores"
ON public.stores
FOR SELECT
TO authenticated
USING (true);

-- 3. FIX WARN: Restrict store_visits INSERT to authenticated users
DROP POLICY IF EXISTS "Anyone can record visits" ON public.store_visits;
CREATE POLICY "Authenticated users can record visits"
ON public.store_visits
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. FIX WARN: Add UPDATE policy for messages (mark as read)
CREATE POLICY "Users can update messages in their conversations"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
  )
);

-- 5. FIX WARN: Add UPDATE policy for conversations
CREATE POLICY "Users can update their conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = participant1_id) OR (auth.uid() = participant2_id)
);

-- 6. FIX INFO: Add DELETE policy for stores
CREATE POLICY "Users can delete their own store"
ON public.stores
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 7. FIX INFO: Add UPDATE policy for post_comments
CREATE POLICY "Users can update their comments"
ON public.post_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
