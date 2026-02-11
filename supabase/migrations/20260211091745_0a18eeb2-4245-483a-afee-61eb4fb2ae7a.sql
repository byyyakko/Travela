
-- Add restriction fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS restriction_reason text;

-- Allow admins to view all reports
CREATE POLICY "Admins can view all reports"
ON public.user_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update report status
CREATE POLICY "Admins can update reports"
ON public.user_reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any profile (for restriction)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
