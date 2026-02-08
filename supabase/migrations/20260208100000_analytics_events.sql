-- Analytics events table for MVP user testing
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_data jsonb default '{}'::jsonb,
  page text,
  session_id text,
  created_at timestamptz default now()
);

-- Index for querying by event type and time
create index idx_analytics_events_type on public.analytics_events(event_type);
create index idx_analytics_events_created on public.analytics_events(created_at desc);
create index idx_analytics_events_user on public.analytics_events(user_id);

-- Enable RLS
alter table public.analytics_events enable row level security;

-- Users can insert their own events (or anonymous events with null user_id)
create policy "Users can insert own events"
  on public.analytics_events for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Allow anonymous event inserts (for pre-auth page views)
create policy "Allow anonymous event inserts"
  on public.analytics_events for insert
  to anon
  with check (user_id is null);

-- Only project owner can read all events (via service role key in Supabase dashboard)
-- Authenticated users can read their own events
create policy "Users can read own events"
  on public.analytics_events for select
  to authenticated
  using (auth.uid() = user_id);
