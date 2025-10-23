-- Add telegram_chat_id to profiles
ALTER TABLE public.profiles
ADD COLUMN telegram_chat_id TEXT;

-- Create trades table for performance journal
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  crypto_name TEXT NOT NULL,
  signal TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  take_profit NUMERIC NOT NULL,
  stop_loss NUMERIC NOT NULL,
  leverage INTEGER NOT NULL,
  result_percent NUMERIC,
  result_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  analysis_data JSONB
);

-- Enable RLS
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- RLS policies for trades
CREATE POLICY "Users can view their own trades"
ON public.trades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trades"
ON public.trades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
ON public.trades
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades"
ON public.trades
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);