create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'invoke-scheduled-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://rrxtaplxbzfwrkhhotot.supabase.co/functions/v1/scheduled-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyeHRhcGx4Ynpmd3JraGhvdG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg0MTk5OCwiZXhwIjoyMDk3NDE3OTk4fQ.MbsfBzaiuhptPN3oVAJq_iFLuwcQ-Otx7_xP4JW0_m8',
      'Content-Type', 'application/json'
    )
  )
  $$
);