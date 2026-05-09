CREATE TABLE public.toilet_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  toilet_key text NOT NULL,
  toilet_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, toilet_key)
);

CREATE INDEX idx_toilet_reviews_key ON public.toilet_reviews (toilet_key);

ALTER TABLE public.toilet_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view toilet reviews"
  ON public.toilet_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own toilet reviews"
  ON public.toilet_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own toilet reviews"
  ON public.toilet_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own toilet reviews"
  ON public.toilet_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_toilet_reviews_updated_at
  BEFORE UPDATE ON public.toilet_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();