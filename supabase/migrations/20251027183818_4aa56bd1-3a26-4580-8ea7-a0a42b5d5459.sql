-- Add capital and risk management fields to user_settings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'user_settings' 
                 AND column_name = 'target_win_rate') THEN
    ALTER TABLE public.user_settings ADD COLUMN target_win_rate numeric DEFAULT 60;
  END IF;
END $$;

-- Add comments for clarity
COMMENT ON COLUMN public.user_settings.capital IS 'Total trading capital in currency';
COMMENT ON COLUMN public.user_settings.risk_percent_per_trade IS 'Risk percentage per trade (e.g., 1 for 1%)';
COMMENT ON COLUMN public.user_settings.target_win_rate IS 'Target win rate percentage (e.g., 60 for 60%)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);