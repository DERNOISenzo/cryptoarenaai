-- Table pour les paramètres de gestion du risque utilisateur
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  capital NUMERIC NOT NULL DEFAULT 1000,
  risk_percent_per_trade NUMERIC NOT NULL DEFAULT 1,
  max_loss_per_day NUMERIC NOT NULL DEFAULT 50,
  current_loss_today NUMERIC NOT NULL DEFAULT 0,
  last_loss_reset TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  preferred_trade_style TEXT NOT NULL DEFAULT 'swing',
  exit_strategy TEXT NOT NULL DEFAULT 'partial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour réinitialiser la perte quotidienne
CREATE OR REPLACE FUNCTION public.reset_daily_loss()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_settings
  SET current_loss_today = 0,
      last_loss_reset = now()
  WHERE last_loss_reset < (now() - interval '1 day');
END;
$$;

-- Cron job pour exécuter le learning engine quotidiennement à 00:00 UTC
SELECT cron.schedule(
  'run-learning-engine-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fzkxeouvmkfvbtpzxeka.supabase.co/functions/v1/learning-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3hlb3V2bWtmdmJ0cHp4ZWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzY5NTksImV4cCI6MjA3NjY1Mjk1OX0.D2bdNg92nyDMXpEC2I4CLZ1WSpJmbbo89Joi5VRphZE"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Cron job pour réinitialiser les pertes quotidiennes à 00:01 UTC
SELECT cron.schedule(
  'reset-daily-losses',
  '1 0 * * *',
  $$
  SELECT public.reset_daily_loss();
  $$
);