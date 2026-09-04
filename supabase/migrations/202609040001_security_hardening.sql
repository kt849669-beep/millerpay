-- Miller Pay application tables are accessed only by the trusted Express API.
-- The server uses the Supabase secret key; browser roles receive no direct access.

alter table if exists public.app_settings enable row level security;
alter table if exists public.login_records enable row level security;

revoke all on table public.app_settings from anon, authenticated;
revoke all on table public.login_records from anon, authenticated;

-- Storage remains publicly readable for homepage media, but browser clients cannot write.
drop policy if exists "miller media anonymous insert" on storage.objects;
drop policy if exists "miller media authenticated insert" on storage.objects;
drop policy if exists "miller media anonymous update" on storage.objects;
drop policy if exists "miller media authenticated update" on storage.objects;
drop policy if exists "miller media anonymous delete" on storage.objects;
drop policy if exists "miller media authenticated delete" on storage.objects;
revoke insert, update, delete on table storage.objects from anon, authenticated;

create index if not exists login_records_created_at_idx
  on public.login_records (created_at desc);
