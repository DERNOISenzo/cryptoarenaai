-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule learning engine to run daily at 3 AM UTC
SELECT cron.schedule(
  'daily-learning-engine',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://fzkxeouvmkfvbtpzxeka.supabase.co/functions/v1/learning-engine',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3hlb3V2bWtmdmJ0cHp4ZWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzY5NTksImV4cCI6MjA3NjY1Mjk1OX0.D2bdNg92nyDMXpEC2I4CLZ1WSpJmbbo89Joi5VRphZE"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Schedule check-alerts to run every minute
SELECT cron.schedule(
  'check-alerts-every-minute',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://fzkxeouvmkfvbtpzxeka.supabase.co/functions/v1/check-alerts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3hlb3V2bWtmdmJ0cHp4ZWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzY5NTksImV4cCI6MjA3NjY1Mjk1OX0.D2bdNg92nyDMXpEC2I4CLZ1WSpJmbbo89Joi5VRphZE"}'::jsonb,
      body := '{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);