create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Cafe' check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scenes (
  id text primary key check (length(btrim(id)) > 0),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  version integer not null default 1 check (version > 0),
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id)
);

create table if not exists public.devices (
  id text primary key check (length(btrim(id)) > 0),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  installation_id text check (installation_id is null or length(btrim(installation_id)) > 0),
  name text,
  group_name text,
  position_label text,
  online boolean not null default false,
  current_scene_id text,
  current_scene_version integer not null default 0 check (current_scene_version >= 0),
  last_heartbeat_at timestamptz,
  last_ack_version integer check (last_ack_version is null or last_ack_version >= 0),
  last_error text,
  app_version text,
  capabilities_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_user_id),
  foreign key (current_scene_id, owner_user_id) references public.scenes(id, owner_user_id)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null check (length(btrim(filename)) > 0),
  mime_type text not null check (length(btrim(mime_type)) > 0),
  storage_bucket text not null check (length(btrim(storage_bucket)) > 0),
  storage_path text not null check (length(btrim(storage_path)) > 0),
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.delivery_history (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  scene_id text not null,
  scene_version integer not null check (scene_version > 0),
  delivered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  error text,
  foreign key (device_id, owner_user_id) references public.devices(id, owner_user_id) on delete cascade,
  foreign key (scene_id, owner_user_id) references public.scenes(id, owner_user_id) on delete cascade
);

create unique index if not exists devices_owner_installation_unique_idx
  on public.devices (owner_user_id, installation_id)
  where installation_id is not null;

create index if not exists devices_owner_user_id_idx on public.devices (owner_user_id);
create index if not exists devices_online_idx on public.devices (last_heartbeat_at) where online = true;
create index if not exists devices_current_scene_owner_idx on public.devices (current_scene_id, owner_user_id) where current_scene_id is not null;

create index if not exists assets_owner_user_id_idx on public.assets (owner_user_id);

create index if not exists scenes_owner_user_id_idx on public.scenes (owner_user_id);
create index if not exists scenes_owner_updated_at_idx on public.scenes (owner_user_id, updated_at desc);

create index if not exists delivery_history_owner_user_id_idx on public.delivery_history (owner_user_id);
create index if not exists delivery_history_device_owner_idx on public.delivery_history (device_id, owner_user_id);
create index if not exists delivery_history_scene_owner_idx on public.delivery_history (scene_id, owner_user_id);
create index if not exists delivery_history_owner_device_version_idx on public.delivery_history (owner_user_id, device_id, scene_version);

alter table public.cafes enable row level security;
alter table public.devices enable row level security;
alter table public.assets enable row level security;
alter table public.scenes enable row level security;
alter table public.delivery_history enable row level security;

alter table public.cafes force row level security;
alter table public.devices force row level security;
alter table public.assets force row level security;
alter table public.scenes force row level security;
alter table public.delivery_history force row level security;

grant select, insert, update, delete on table
  public.cafes,
  public.devices,
  public.assets,
  public.scenes,
  public.delivery_history
to authenticated;

drop policy if exists "cafes are owned by auth user" on public.cafes;
create policy "cafes are owned by auth user"
  on public.cafes for all
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "devices are owned by auth user" on public.devices;
create policy "devices are owned by auth user"
  on public.devices for all
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "assets are owned by auth user" on public.assets;
create policy "assets are owned by auth user"
  on public.assets for all
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "scenes are owned by auth user" on public.scenes;
create policy "scenes are owned by auth user"
  on public.scenes for all
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists "delivery history is owned by auth user" on public.delivery_history;
create policy "delivery history is owned by auth user"
  on public.delivery_history for all
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

insert into storage.buckets (id, name, public)
values ('tvsys-assets', 'tvsys-assets', false)
on conflict (id) do update set public = false;
