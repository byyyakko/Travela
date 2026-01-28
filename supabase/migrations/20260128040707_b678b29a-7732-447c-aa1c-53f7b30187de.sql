-- Create rate_limits table for tracking API usage
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  action_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_rate_limits_user_action ON public.rate_limits(user_id, action_type, window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow system to manage rate limits (no direct user access)
CREATE POLICY "System manages rate limits"
ON public.rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- Create function to check and update rate limits
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
  
  -- Get current count in window
  SELECT COALESCE(SUM(action_count), 0) INTO _current_count
  FROM public.rate_limits
  WHERE user_id = _user_id
    AND action_type = _action_type
    AND window_start >= _window_start;
  
  -- Check if limit exceeded
  IF _current_count >= _max_requests THEN
    RETURN false;
  END IF;
  
  -- Record this action
  INSERT INTO public.rate_limits (user_id, action_type, window_start)
  VALUES (_user_id, _action_type, now());
  
  -- Cleanup old entries (older than 24 hours)
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
  
  RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;