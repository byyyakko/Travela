-- Add category column to posts table
ALTER TABLE public.posts ADD COLUMN category text NULL;

-- Create index for filtering by category
CREATE INDEX idx_posts_category ON public.posts (category);
