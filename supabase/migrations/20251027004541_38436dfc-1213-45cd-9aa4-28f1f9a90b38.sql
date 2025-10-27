-- Fix function search path for reset_daily_loss
CREATE OR REPLACE FUNCTION public.reset_daily_loss()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_settings
  SET current_loss_today = 0,
      last_loss_reset = now()
  WHERE last_loss_reset < (now() - interval '1 day');
END;
$$;