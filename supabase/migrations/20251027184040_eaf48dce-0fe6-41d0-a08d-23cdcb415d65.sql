-- Create cron job to run learning engine daily at midnight
SELECT cron.schedule(
  'run-learning-engine-daily',
  '0 0 * * *', -- Every day at midnight
  $$
  SELECT net.http_post(
    url := current_setting('app.settings')::json->>'supabase_url' || '/functions/v1/learning-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings')::json->>'supabase_anon_key'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Also create a function to manually trigger learning engine
CREATE OR REPLACE FUNCTION public.trigger_learning_engine()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  response_status int;
BEGIN
  SELECT status INTO response_status
  FROM http((
    'POST',
    current_setting('app.settings')::json->>'supabase_url' || '/functions/v1/learning-engine',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.settings')::json->>'supabase_anon_key'),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  RAISE NOTICE 'Learning engine manually triggered with status: %', response_status;
END;
$$;