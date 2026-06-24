create table if not exists public.display_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  token_hash text not null unique check (length(btrim(token_hash)) > 0),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  expires_at timestamptz not null,
  rotated_at timestamptz,
  revoked_at timestamptz,
  foreign key (device_id, owner_user_id) references public.devices(id, owner_user_id) on delete cascade
);

create index if not exists display_sessions_owner_user_id_idx on public.display_sessions (owner_user_id);
create index if not exists display_sessions_device_owner_idx on public.display_sessions (device_id, owner_user_id);
create index if not exists display_sessions_active_idx
  on public.display_sessions (token_hash, expires_at)
  where revoked_at is null and rotated_at is null;

alter table public.display_sessions enable row level security;
alter table public.display_sessions force row level security;

grant select, insert, update, delete on table public.display_sessions to authenticated;

drop policy if exists "display sessions are owned by auth user" on public.display_sessions;
create policy "display sessions are owned by auth user"
  on public.display_sessions for all
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);
