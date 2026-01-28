-- Create itinerary_items table for daily activities
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

-- Enable Row Level Security
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own itinerary items" 
ON public.itinerary_items 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own itinerary items" 
ON public.itinerary_items 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itinerary items" 
ON public.itinerary_items 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itinerary items" 
ON public.itinerary_items 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_itinerary_items_updated_at
BEFORE UPDATE ON public.itinerary_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();