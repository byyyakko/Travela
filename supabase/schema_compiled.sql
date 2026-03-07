-- ============================================================
-- Travela — Full Schema
-- Compiled from all migrations in chronological order.
-- Run this in the Supabase SQL Editor of your new project.
-- ============================================================


-- ----------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------
CREATE TYPE public.user_theme AS ENUM ('minimalist', 'cutesy', 'anime');
CREATE TYPE public.app_role AS ENUM ('user', 'merchant', 'admin');
CREATE TYPE public.store_type AS ENUM ('attractions', 'food', 'entertainment');
CREATE TYPE public.subscription_tier AS ENUM ('tier_0', 'tier_1', 'tier_2');
CREATE TYPE public.user_subscription_tier AS ENUM ('tier_0', 'tier_1', 'tier_2');


-- ----------------------------------------------------------------
-- FUNCTIONS (defined before triggers that use them)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_mutual_match()
RETURNS TRIGGER AS $$
DECLARE
  reverse_match_exists BOOLEAN;
BEGIN
  IF NEW.action = 'like' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.matches
      WHERE user_id = NEW.target_user_id
      AND target_user_id = NEW.user_id
      AND action = 'like'
    ) INTO reverse_match_exists;

    IF reverse_match_exists THEN
      INSERT INTO public.mutual_matches (user1_id, user2_id)
      VALUES (
        LEAST(NEW.user_id, NEW.target_user_id),
        GREATEST(NEW.user_id, NEW.target_user_id)
      ) ON CONFLICT DO NOTHING;

      INSERT INTO public.conversations (participant1_id, participant2_id)
      VALUES (
        LEAST(NEW.user_id, NEW.target_user_id),
        GREATEST(NEW.user_id, NEW.target_user_id)
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _action_type text,
  _max_requests integer,
  _window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_start timestamp with time zone;
  _current_count integer;
BEGIN
  _window_start := now() - (_window_minutes || ' minutes')::interval;

  SELECT COALESCE(SUM(action_count), 0) INTO _current_count
  FROM public.rate_limits
  WHERE user_id = _user_id
    AND action_type = _action_type
    AND window_start >= _window_start;

  IF _current_count >= _max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (user_id, action_type, window_start)
  VALUES (_user_id, _action_type, now());

  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_merchant_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'merchant' THEN
    IF NOT EXISTS (SELECT 1 FROM public.stores WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Cannot assign merchant role without an existing store';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  theme user_theme DEFAULT 'minimalist' NOT NULL,
  is_local BOOLEAN DEFAULT FALSE,
  interests TEXT[],
  date_of_birth DATE,
  min_age_preference INTEGER DEFAULT 18 CHECK (min_age_preference >= 18),
  max_age_preference INTEGER DEFAULT 99 CHECK (max_age_preference >= 18),
  is_verified boolean DEFAULT false,
  destination text,
  travel_start_date date,
  travel_end_date date,
  languages text[] DEFAULT '{}',
  subscription_tier public.user_subscription_tier NOT NULL DEFAULT 'tier_0',
  is_restricted boolean NOT NULL DEFAULT false,
  restriction_reason text,
  activity_vibe text DEFAULT 'both',
  time_availability text[] DEFAULT '{}'::text[],
  has_seen_tutorial boolean NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT age_preference_range CHECK (min_age_preference <= max_age_preference)
);

-- posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  image_urls text[] DEFAULT '{}'::text[],
  location_tag TEXT,
  category text NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_posts_category ON public.posts (category);

-- post_likes
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- post_comments
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- post_bookmarks
CREATE TABLE public.post_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT CHECK (action IN ('like', 'pass')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, target_user_id)
);

-- mutual_matches
CREATE TABLE public.mutual_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user1_id, user2_id)
);

-- conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  accepted boolean DEFAULT null,
  declined_at timestamp with time zone DEFAULT null,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(participant1_id, participant2_id)
);

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- user_reports
CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT different_users CHECK (reporter_id != reported_user_id)
);

-- blocked_users
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT different_users CHECK (user_id != blocked_user_id),
  CONSTRAINT unique_block UNIQUE (user_id, blocked_user_id)
);

-- rate_limits
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  action_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_user_action ON public.rate_limits(user_id, action_type, window_start);

-- trips
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  interests TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'planned')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- itinerary_items
CREATE TABLE public.itinerary_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  day_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  time TEXT,
  location TEXT,
  category TEXT DEFAULT 'activity',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- stores
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  phone TEXT,
  store_type public.store_type NOT NULL DEFAULT 'food',
  subscription_tier public.subscription_tier NOT NULL DEFAULT 'tier_0',
  address text,
  latitude double precision,
  longitude double precision,
  country text,
  description text,
  website_url text,
  dietary_options text[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- store_visits
CREATE TABLE public.store_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  visitor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  visitor_country TEXT,
  page_viewed TEXT DEFAULT 'profile'
);

-- store_items
CREATE TABLE public.store_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  ordering_tip TEXT,
  price TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- store_images
CREATE TABLE public.store_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- analytics_events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  page text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON public.analytics_events(user_id);

-- profile_photos
CREATE TABLE public.profile_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_photos_user_id ON public.profile_photos (user_id, display_order);

-- profile_prompts
CREATE TABLE public.profile_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_prompts_user_id ON public.profile_prompts (user_id, display_order);

-- follows
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- circles
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

-- circle_memberships
CREATE TABLE public.circle_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'host', 'mod')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, circle_id)
);

-- circle_posts
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

-- circle_meetup_requests
CREATE TABLE public.circle_meetup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.circle_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- experiences
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

CREATE INDEX idx_experiences_schedule ON public.experiences(schedule);
CREATE INDEX idx_experiences_city ON public.experiences(city);
CREATE INDEX idx_experiences_tags ON public.experiences USING GIN(tags);

-- experience_join_requests
CREATE TABLE public.experience_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES public.experiences(id) ON DELETE CASCADE,
  traveller_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(experience_id, traveller_id)
);

-- itinerary_history
CREATE TABLE public.itinerary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  title text NOT NULL,
  itinerary_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_itinerary_history_user_id ON public.itinerary_history (user_id, created_at DESC);


-- ----------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutual_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_meetup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_history ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------

-- profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- posts
CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- post_likes
CREATE POLICY "Anyone can view likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- post_comments
CREATE POLICY "Anyone can view comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their comments" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- post_bookmarks
CREATE POLICY "Users can view their bookmarks" ON public.post_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookmarks" ON public.post_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their bookmarks" ON public.post_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- matches
CREATE POLICY "Users can view their matches" ON public.matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create matches" ON public.matches FOR INSERT WITH CHECK (auth.uid() = user_id);

-- mutual_matches
CREATE POLICY "Users can view their mutual matches" ON public.mutual_matches FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- conversations
CREATE POLICY "Users can view their conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);
CREATE POLICY "Users can update their conversations" ON public.conversations FOR UPDATE TO authenticated USING ((auth.uid() = participant1_id) OR (auth.uid() = participant2_id));

-- messages
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conversation_id
    AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
  ));
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conversation_id
    AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
  ));
CREATE POLICY "Users can update messages in their conversations" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
  ));

-- user_reports
CREATE POLICY "Users can create reports" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view their own reports" ON public.user_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.user_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update reports" ON public.user_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- blocked_users
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their blocks" ON public.blocked_users FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can unblock others" ON public.blocked_users FOR DELETE USING (auth.uid() = user_id);

-- rate_limits
CREATE POLICY "System manages rate limits" ON public.rate_limits FOR ALL USING (false) WITH CHECK (false);

-- trips
CREATE POLICY "Users can view their own trips" ON public.trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own trips" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own trips" ON public.trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trips" ON public.trips FOR DELETE USING (auth.uid() = user_id);

-- itinerary_items
CREATE POLICY "Users can view their own itinerary items" ON public.itinerary_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own itinerary items" ON public.itinerary_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own itinerary items" ON public.itinerary_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own itinerary items" ON public.itinerary_items FOR DELETE USING (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- stores
CREATE POLICY "Authenticated users can view stores" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own store" ON public.stores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own store" ON public.stores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own store" ON public.stores FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- store_visits
CREATE POLICY "Store owners can view their visits" ON public.store_visits FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = store_visits.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Authenticated users can record visits" ON public.store_visits FOR INSERT TO authenticated
  WITH CHECK (visitor_user_id IS NULL OR visitor_user_id = auth.uid());

-- store_items
CREATE POLICY "Anyone can view store items" ON public.store_items FOR SELECT USING (true);
CREATE POLICY "Merchants can create store items" ON public.store_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Merchants can update their store items" ON public.store_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Merchants can delete their store items" ON public.store_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()));

-- store_images
CREATE POLICY "Anyone can view store images" ON public.store_images FOR SELECT USING (true);
CREATE POLICY "Merchants can insert their store images" ON public.store_images FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_images.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Merchants can update their store images" ON public.store_images FOR UPDATE
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_images.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Merchants can delete their store images" ON public.store_images FOR DELETE
  USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_images.store_id AND stores.user_id = auth.uid()));

-- analytics_events
CREATE POLICY "Users can insert own events" ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow anonymous event inserts" ON public.analytics_events FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Users can read own events" ON public.analytics_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profile_photos
CREATE POLICY "Anyone can view profile photos" ON public.profile_photos FOR SELECT USING (true);
CREATE POLICY "Users can insert their own photos" ON public.profile_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own photos" ON public.profile_photos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own photos" ON public.profile_photos FOR DELETE USING (auth.uid() = user_id);

-- profile_prompts
CREATE POLICY "Anyone can view profile prompts" ON public.profile_prompts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own prompts" ON public.profile_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own prompts" ON public.profile_prompts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own prompts" ON public.profile_prompts FOR DELETE USING (auth.uid() = user_id);

-- follows
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- circles
CREATE POLICY "Anyone authenticated can view circles" ON public.circles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create circles" ON public.circles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update circle" ON public.circles FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete circle" ON public.circles FOR DELETE USING (auth.uid() = created_by);

-- circle_memberships
CREATE POLICY "Anyone can view memberships" ON public.circle_memberships FOR SELECT USING (true);
CREATE POLICY "Users can join circles" ON public.circle_memberships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave circles" ON public.circle_memberships FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Hosts can manage memberships" ON public.circle_memberships FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.circle_memberships cm WHERE cm.circle_id = circle_memberships.circle_id AND cm.user_id = auth.uid() AND cm.role IN ('host', 'mod'))
);

-- circle_posts
CREATE POLICY "Members can view circle posts" ON public.circle_posts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.circle_memberships WHERE circle_id = circle_posts.circle_id AND user_id = auth.uid())
);
CREATE POLICY "Members can create posts" ON public.circle_posts FOR INSERT WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (SELECT 1 FROM public.circle_memberships WHERE circle_id = circle_posts.circle_id AND user_id = auth.uid())
);
CREATE POLICY "Authors can update their posts" ON public.circle_posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete their posts" ON public.circle_posts FOR DELETE USING (auth.uid() = author_id);

-- circle_meetup_requests
CREATE POLICY "Post author and requester can view requests" ON public.circle_meetup_requests FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.circle_posts WHERE id = circle_meetup_requests.post_id AND author_id = auth.uid())
);
CREATE POLICY "Users can request to join" ON public.circle_meetup_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Post author can update request status" ON public.circle_meetup_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.circle_posts WHERE id = circle_meetup_requests.post_id AND author_id = auth.uid())
);
CREATE POLICY "Users can cancel their request" ON public.circle_meetup_requests FOR DELETE USING (auth.uid() = user_id);

-- experiences
CREATE POLICY "Anyone authenticated can view experiences" ON public.experiences FOR SELECT USING (true);
CREATE POLICY "Users can create experiences" ON public.experiences FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update their experiences" ON public.experiences FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Hosts can delete their experiences" ON public.experiences FOR DELETE USING (auth.uid() = host_id);

-- experience_join_requests
CREATE POLICY "Host and requester can view requests" ON public.experience_join_requests FOR SELECT USING (
  auth.uid() = traveller_id OR
  EXISTS (SELECT 1 FROM public.experiences WHERE id = experience_join_requests.experience_id AND host_id = auth.uid())
);
CREATE POLICY "Users can request to join" ON public.experience_join_requests FOR INSERT WITH CHECK (auth.uid() = traveller_id);
CREATE POLICY "Host can update request status" ON public.experience_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.experiences WHERE id = experience_join_requests.experience_id AND host_id = auth.uid())
);
CREATE POLICY "Users can cancel their request" ON public.experience_join_requests FOR DELETE USING (auth.uid() = traveller_id);

-- itinerary_history
CREATE POLICY "Users can view their own history" ON public.itinerary_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own history" ON public.itinerary_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own history" ON public.itinerary_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own history" ON public.itinerary_history FOR DELETE USING (auth.uid() = user_id);


-- ----------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_reports_updated_at BEFORE UPDATE ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_itinerary_items_updated_at BEFORE UPDATE ON public.itinerary_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_store_items_updated_at BEFORE UPDATE ON public.store_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_circles_updated_at BEFORE UPDATE ON public.circles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_circle_posts_updated_at BEFORE UPDATE ON public.circle_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_experiences_updated_at BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_itinerary_history_updated_at BEFORE UPDATE ON public.itinerary_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_match_created
  AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.check_mutual_match();

CREATE TRIGGER check_merchant_has_store
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.validate_merchant_role();


-- ----------------------------------------------------------------
-- STORAGE BUCKETS
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('store-items', 'store-items', true);

-- post-images policies
CREATE POLICY "Anyone can view post images" ON storage.objects FOR SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Users can upload post images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their post images" ON storage.objects FOR UPDATE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their post images" ON storage.objects FOR DELETE USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- avatars policies
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- store-items policies
CREATE POLICY "Anyone can view store item images" ON storage.objects FOR SELECT USING (bucket_id = 'store-items');
CREATE POLICY "Merchants can upload store item images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-items' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Merchants can update their store item images" ON storage.objects FOR UPDATE USING (bucket_id = 'store-items' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Merchants can delete their store item images" ON storage.objects FOR DELETE USING (bucket_id = 'store-items' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ----------------------------------------------------------------
-- REALTIME
-- ----------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;


-- ----------------------------------------------------------------
-- GRANTS
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
