
-- Fix 1: Prevent merchant role self-assignment without a store
-- Create a trigger that validates a store exists before allowing merchant role
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

CREATE TRIGGER check_merchant_has_store
BEFORE INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_merchant_role();
