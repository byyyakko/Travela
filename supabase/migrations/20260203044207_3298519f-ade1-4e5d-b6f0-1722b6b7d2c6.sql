-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'merchant');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
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

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Create stores table for merchants
CREATE TABLE public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    store_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- RLS policies for stores
CREATE POLICY "Users can view all stores"
ON public.stores
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own store"
ON public.stores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own store"
ON public.stores
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();