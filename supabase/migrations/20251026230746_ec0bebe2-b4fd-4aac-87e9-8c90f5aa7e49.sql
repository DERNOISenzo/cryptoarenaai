-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a scheduled job to run learning-engine every day at 2 AM UTC
-- This will continuously optimize the analysis parameters based on trading performance
SELECT cron.schedule(
  'daily-learning-engine-update',
  '0 2 * * *', -- Every day at 2 AM UTC
  $$
  SELECT
    net.http_post(
        url:='https://fzkxeouvmkfvbtpzxeka.supabase.co/functions/v1/learning-engine',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a3hlb3V2bWtmdmJ0cHp4ZWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNzY5NTksImV4cCI6MjA3NjY1Mjk1OX0.D2bdNg92nyDMXpEC2I4CLZ1WSpJmbbo89Joi5VRphZE"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);