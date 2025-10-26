-- Create table for storing analysis parameters adjusted by learning engine
CREATE TABLE IF NOT EXISTS public.analysis_params (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rsi_oversold_threshold integer NOT NULL DEFAULT 30,
  rsi_overbought_threshold integer NOT NULL DEFAULT 70,
  atr_multiplier_tp numeric NOT NULL DEFAULT 2.0,
  atr_multiplier_sl numeric NOT NULL DEFAULT 1.0,
  confidence_threshold integer NOT NULL DEFAULT 60,
  min_bullish_score integer NOT NULL DEFAULT 8,
  preferred_signal text NOT NULL DEFAULT 'LONG',
  max_leverage integer NOT NULL DEFAULT 5,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.analysis_params ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own params"
  ON public.analysis_params
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own params"
  ON public.analysis_params
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own params"
  ON public.analysis_params
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_analysis_params_updated_at
  BEFORE UPDATE ON public.analysis_params
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();