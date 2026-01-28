-- Create trips table for travel planning
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

-- Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own trips"
ON public.trips
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trips"
ON public.trips
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
ON public.trips
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
ON public.trips
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_trips_updated_at
BEFORE UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();