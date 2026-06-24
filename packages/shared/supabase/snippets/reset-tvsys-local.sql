-- Local/dev reset for TVSys Supabase data.
--
-- This snippet is intentionally destructive:
-- - clears TVSys app tables
-- - clears TVSys Storage object metadata
-- - deletes Supabase Auth users except the preserved local user below
--
-- Do not use this on hosted/production Storage. Supabase Storage object deletion
-- should go through the Storage API; SQL-only metadata deletion can orphan files
-- in the backing object store.

begin;

do $$
declare
  preserved_user_id constant uuid := '416a3f5c-c99f-4061-97c1-0935d160c74f';
begin
  if not exists (
    select 1
    from auth.users
    where id = preserved_user_id
  ) then
    raise exception 'Required preserved auth user % does not exist', preserved_user_id;
  end if;
end $$;

delete from storage.objects
where bucket_id = 'tvsys-assets';

insert into storage.buckets (id, name, public)
values ('tvsys-assets', 'tvsys-assets', false)
on conflict (id) do update set public = false;

truncate table
  public.delivery_history,
  public.assets,
  public.devices,
  public.scenes,
  public.cafes
restart identity;

delete from auth.users
where id <> '416a3f5c-c99f-4061-97c1-0935d160c74f'::uuid;

do $$
declare
  preserved_user_id constant uuid := '416a3f5c-c99f-4061-97c1-0935d160c74f';
begin
  if not exists (
    select 1
    from auth.users
    where id = preserved_user_id
  ) then
    raise exception 'Preserved auth user % was deleted during reset', preserved_user_id;
  end if;
end $$;

commit;
