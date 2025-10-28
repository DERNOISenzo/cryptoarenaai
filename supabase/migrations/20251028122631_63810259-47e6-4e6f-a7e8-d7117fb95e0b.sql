-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule learning engine to run daily at 2 AM UTC
SELECT cron.schedule(
  'run-learning-engine-daily',
  '0 2 * * *', -- Every day at 2 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://fzkxeouvmkfvbtpzxeka.supabase.co/functions/v1/learning-engine',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3hlb3V2bWtmdmJ0cHp4ZWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzY5NTksImV4cCI6MjA3NjY1Mjk1OX0.D2bdNg92nyDMXpEC2I4CLZ1WSpJmbbo89Joi5VRphZE"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule learning engine to run weekly (every Monday at 3 AM UTC)
SELECT cron.schedule(
  'run-learning-engine-weekly',
  '0 3 * * 1', -- Every Monday at 3 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://fzkxeouvmkfvbtpzxeka.supabase.co/functions/v1/learning-engine',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3hlb3V2bWtmdmJ0cHp4ZWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzY5NTksImV4cCI6MjA3NjY1Mjk1OX0.D2bdNg92nyDMXpEC2I4CLZ1WSpJmbbo89Joi5VRphZE"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);