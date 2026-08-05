create extension if not exists pg_net;

create or replace function notify_new_booking()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://rrxtaplxbzfwrkhhotot.supabase.co/functions/v1/notify-new-booking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyeHRhcGx4Ynpmd3JraGhvdG90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg0MTk5OCwiZXhwIjoyMDk3NDE3OTk4fQ.MbsfBzaiuhptPN3oVAJq_iFLuwcQ-Otx7_xP4JW0_m8'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'trainer_appointments',
      'record', to_jsonb(NEW)
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_notify_new_booking
after insert on trainer_appointments
for each row
execute function notify_new_booking();