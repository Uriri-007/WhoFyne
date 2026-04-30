-- WhoFyne Supabase schema
-- Run this in the Supabase SQL editor before using the app.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gender_identity') then
    create type public.gender_identity as enum ('male', 'female', 'other', 'prefer_not_to_say');
  end if;

  if not exists (select 1 from pg_type where typname = 'vote_type') then
    create type public.vote_type as enum ('up', 'down');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,
  avatar_url text,
  gender public.gender_identity not null default 'prefer_not_to_say',
  is_uploader boolean not null default false,
  total_votes_received integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whitelist (
  email text primary key,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  image_url text not null,
  title text not null,
  upvotes integer not null default 0 check (upvotes >= 0),
  downvotes integer not null default 0 check (downvotes >= 0),
  total_votes integer not null default 0,
  day_key date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uploads_one_per_uploader_per_day unique (uploader_id, day_key),
  constraint uploads_total_votes_match check (total_votes = upvotes - downvotes)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  upload_id uuid not null references public.uploads(id) on delete cascade,
  type public.vote_type not null,
  created_at timestamptz not null default now(),
  constraint votes_one_per_user_per_upload unique (user_id, upload_id)
);

create index if not exists uploads_created_at_idx on public.uploads (created_at desc);
create index if not exists uploads_uploader_id_idx on public.uploads (uploader_id);
create index if not exists votes_user_id_idx on public.votes (user_id);
create index if not exists votes_upload_id_idx on public.votes (upload_id);
create index if not exists profiles_leaderboard_idx on public.profiles (is_uploader, total_votes_received desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'okhaiuri@gmail.com',
      'ogboumahokhai@gmail.com'
    );
$$;

create or replace function public.is_whitelisted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.whitelist w
      where lower(w.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, avatar_url, is_uploader)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'User'
    ),
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', ''),
      'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id::text
    ),
    exists (
      select 1
      from public.whitelist w
      where lower(w.email) = lower(coalesce(new.email, ''))
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_profile_uploader_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set is_uploader = true,
      updated_at = now()
  where lower(email) = lower(new.email);

  return new;
end;
$$;

create or replace function public.validate_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  upload_owner uuid;
begin
  select uploader_id into upload_owner
  from public.uploads
  where id = new.upload_id;

  if upload_owner is null then
    raise exception 'Upload not found.';
  end if;

  if upload_owner = new.user_id then
    raise exception 'You cannot vote for your own upload.';
  end if;

  return new;
end;
$$;

create or replace function public.apply_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vote_delta integer := case when new.type = 'up' then 1 else -1 end;
begin
  update public.uploads
  set
    upvotes = upvotes + case when new.type = 'up' then 1 else 0 end,
    downvotes = downvotes + case when new.type = 'down' then 1 else 0 end,
    total_votes = total_votes + vote_delta,
    updated_at = now()
  where id = new.upload_id;

  update public.profiles p
  set total_votes_received = total_votes_received + vote_delta,
      updated_at = now()
  from public.uploads u
  where u.id = new.upload_id
    and p.id = u.uploader_id;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_uploads_updated_at on public.uploads;
create trigger set_uploads_updated_at
before update on public.uploads
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_whitelist_added on public.whitelist;
create trigger on_whitelist_added
after insert on public.whitelist
for each row execute function public.sync_profile_uploader_status();

drop trigger if exists before_vote_insert on public.votes;
create trigger before_vote_insert
before insert on public.votes
for each row execute function public.validate_vote();

drop trigger if exists after_vote_insert on public.votes;
create trigger after_vote_insert
after insert on public.votes
for each row execute function public.apply_vote_counts();

alter table public.profiles enable row level security;
alter table public.whitelist enable row level security;
alter table public.uploads enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can update safe profile fields" on public.profiles;
create policy "Users can update safe profile fields"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Whitelist is readable" on public.whitelist;
create policy "Whitelist is readable"
on public.whitelist for select
to anon, authenticated
using (true);

drop policy if exists "Only admins manage whitelist" on public.whitelist;
create policy "Only admins manage whitelist"
on public.whitelist for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Uploads are public" on public.uploads;
create policy "Uploads are public"
on public.uploads for select
to anon, authenticated
using (true);

drop policy if exists "Whitelisted users create today's own upload" on public.uploads;
create policy "Whitelisted users create today's own upload"
on public.uploads for insert
to authenticated
with check (
  (select auth.uid()) = uploader_id
  and public.is_whitelisted()
  and day_key = current_date
  and upvotes = 0
  and downvotes = 0
  and total_votes = 0
);

drop policy if exists "Owners can edit upload metadata" on public.uploads;
create policy "Owners can edit upload metadata"
on public.uploads for update
to authenticated
using ((select auth.uid()) = uploader_id)
with check ((select auth.uid()) = uploader_id);

drop policy if exists "Owners and admins can delete uploads" on public.uploads;
create policy "Owners and admins can delete uploads"
on public.uploads for delete
to authenticated
using ((select auth.uid()) = uploader_id or public.is_admin());

drop policy if exists "Votes are public" on public.votes;
create policy "Votes are public"
on public.votes for select
to anon, authenticated
using (true);

drop policy if exists "Users cast their own votes" on public.votes;
create policy "Users cast their own votes"
on public.votes for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke update on public.profiles from anon, authenticated;
grant update (username, gender, avatar_url, updated_at) on public.profiles to authenticated;

revoke update on public.uploads from anon, authenticated;
grant update (title, updated_at) on public.uploads to authenticated;

-- Public upload bucket. Images are stored here; upload rows only store paths/URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read uploaded images" on storage.objects;
create policy "Public read uploaded images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'uploads');

drop policy if exists "Users upload into own folder" on storage.objects;
create policy "Users upload into own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Users update own uploaded images" on storage.objects;
create policy "Users update own uploaded images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Users delete own uploaded images" on storage.objects;
create policy "Users delete own uploaded images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = (select auth.uid())::text
);
