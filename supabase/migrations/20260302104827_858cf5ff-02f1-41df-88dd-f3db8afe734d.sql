
-- Circles table
CREATE TABLE public.circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  city TEXT,
  cover_image TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view circles" ON public.circles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create circles" ON public.circles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update circle" ON public.circles FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete circle" ON public.circles FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_circles_updated_at BEFORE UPDATE ON public.circles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Circle memberships
CREATE TABLE public.circle_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'host', 'mod')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, circle_id)
);

ALTER TABLE public.circle_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view memberships" ON public.circle_memberships FOR SELECT USING (true);
CREATE POLICY "Users can join circles" ON public.circle_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave circles" ON public.circle_memberships FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Hosts can manage memberships" ON public.circle_memberships FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.circle_memberships cm
    WHERE cm.circle_id = circle_memberships.circle_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('host', 'mod')
  )
);

-- Circle posts
CREATE TABLE public.circle_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'question' CHECK (post_type IN ('availability', 'question', 'meetup')),
  text TEXT NOT NULL,
  date_time TIMESTAMPTZ,
  location TEXT,
  max_people INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.circle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view circle posts" ON public.circle_posts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.circle_memberships WHERE circle_id = circle_posts.circle_id AND user_id = auth.uid())
);
CREATE POLICY "Members can create posts" ON public.circle_posts FOR INSERT WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (SELECT 1 FROM public.circle_memberships WHERE circle_id = circle_posts.circle_id AND user_id = auth.uid())
);
CREATE POLICY "Authors can update their posts" ON public.circle_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete their posts" ON public.circle_posts FOR DELETE USING (auth.uid() = author_id);

CREATE TRIGGER update_circle_posts_updated_at BEFORE UPDATE ON public.circle_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Meetup join requests
CREATE TABLE public.circle_meetup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.circle_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.circle_meetup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post author and requester can view requests" ON public.circle_meetup_requests FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.circle_posts WHERE id = circle_meetup_requests.post_id AND author_id = auth.uid())
);
CREATE POLICY "Users can request to join" ON public.circle_meetup_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Post author can update request status" ON public.circle_meetup_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.circle_posts WHERE id = circle_meetup_requests.post_id AND author_id = auth.uid())
);
CREATE POLICY "Users can cancel their request" ON public.circle_meetup_requests FOR DELETE USING (auth.uid() = user_id);
