-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to invoke the learning-engine edge function
CREATE OR REPLACE FUNCTION public.run_learning_engine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status int;
BEGIN
  -- Call the learning-engine edge function
  SELECT status INTO response_status
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/learning-engine',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  RAISE NOTICE 'Learning engine executed with status: %', response_status;
END;
$$;

-- Schedule learning-engine to run every Sunday at 2 AM
SELECT cron.schedule(
  'weekly-learning-engine',
  '0 2 * * 0',
  $$SELECT public.run_learning_engine();$$
);