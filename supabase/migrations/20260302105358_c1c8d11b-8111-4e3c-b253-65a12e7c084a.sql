
-- Experiences table
CREATE TABLE public.experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  city TEXT,
  duration TEXT,
  price TEXT,
  max_people INTEGER,
  meeting_point TEXT,
  schedule TIMESTAMPTZ,
  safety_guidelines TEXT,
  what_to_bring TEXT,
  language TEXT,
  itinerary TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view experiences" ON public.experiences FOR SELECT USING (true);
CREATE POLICY "Users can create experiences" ON public.experiences FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update their experiences" ON public.experiences FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete their experiences" ON public.experiences FOR DELETE USING (auth.uid() = host_id);

CREATE TRIGGER update_experiences_updated_at BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Experience join requests
CREATE TABLE public.experience_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  traveller_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(experience_id, traveller_id)
);

ALTER TABLE public.experience_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host and requester can view requests" ON public.experience_join_requests FOR SELECT USING (
  auth.uid() = traveller_id OR
  EXISTS (SELECT 1 FROM public.experiences WHERE id = experience_join_requests.experience_id AND host_id = auth.uid())
);
CREATE POLICY "Users can request to join" ON public.experience_join_requests FOR INSERT WITH CHECK (auth.uid() = traveller_id);
CREATE POLICY "Host can update request status" ON public.experience_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.experiences WHERE id = experience_join_requests.experience_id AND host_id = auth.uid())
);
CREATE POLICY "Users can cancel their request" ON public.experience_join_requests FOR DELETE USING (auth.uid() = traveller_id);

-- Index for faster queries
CREATE INDEX idx_experiences_schedule ON public.experiences(schedule);
CREATE INDEX idx_experiences_city ON public.experiences(city);
CREATE INDEX idx_experiences_tags ON public.experiences USING GIN(tags);
