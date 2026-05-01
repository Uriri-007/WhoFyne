-- Supabase Schema for WhoFyne
-- Run these queries in your Supabase SQL Editor to initialize the database

-- 1. Create Users Table
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  uid text unique,
  email text,
  username text,
  "avatarUrl" text,
  "themePreference" text default 'system',
  gender text default 'prefer_not_to_say',
  "isUploader" boolean default false,
  "totalVotesReceived" integer default 0,
  "createdAt" timestamp with time zone default now()
);

-- Turn on Row Level Security for users
alter table public.users enable row level security;

create policy "Users are viewable by everyone" 
on public.users for select 
using ( true );

create policy "Users can insert their own profile" 
on public.users for insert 
with check ( auth.uid() = id );

create policy "Users can update own profile" 
on public.users for update 
using ( auth.uid() = id );

-- Optional: If the app needs to update totalVotesReceived from the frontend,
-- you might need to relax the update policy or use a stored procedure / trigger.
create policy "Anyone can update totalVotesReceived" 
on public.users for update 
using ( true )
with check ( true );

-- 2. Create Whitelist Table
create table public.whitelist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  "addedAt" timestamp with time zone default now()
);

alter table public.whitelist enable row level security;

create policy "Whitelist is viewable by everyone" 
on public.whitelist for select 
using ( true );

-- 3. Create Uploads Table
create table public.uploads (
  id uuid default gen_random_uuid() primary key,
  "uploaderId" uuid references public.users(id) on delete cascade,
  "uploaderName" text,
  "uploaderAvatar" text,
  "imageUrl" text not null,
  title text not null,
  upvotes integer default 0,
  downvotes integer default 0,
  "totalVotes" integer default 0,
  "dayKey" text not null,
  "createdAt" timestamp with time zone default now()
);

alter table public.uploads enable row level security;

create policy "Uploads are viewable by everyone" 
on public.uploads for select 
using ( true );

create policy "Uploaders can insert their own uploads" 
on public.uploads for insert 
with check ( auth.uid() = "uploaderId" );

create policy "Anyone can update votes on uploads"
on public.uploads for update
using ( true )
with check ( true );

-- 4. Create Votes Table
create table public.votes (
  id text primary key, -- user_id + _ + upload_id
  "userId" uuid references public.users(id) on delete cascade,
  "uploadId" uuid references public.uploads(id) on delete cascade,
  type text not null check (type in ('up', 'down')),
  "createdAt" timestamp with time zone default now()
);

alter table public.votes enable row level security;

create policy "Votes are viewable by everyone" 
on public.votes for select 
using ( true );

create policy "Users can insert their own votes" 
on public.votes for insert 
with check ( auth.uid() = "userId" );

-- 5. Create Daily Upload Log Table
create table public.daily_upload_log (
  id text primary key, -- user_id + _ + dayKey
  "userId" uuid references public.users(id) on delete cascade,
  "dayKey" text not null,
  "uploadId" uuid references public.uploads(id) on delete cascade,
  "createdAt" timestamp with time zone default now()
);

alter table public.daily_upload_log enable row level security;

create policy "Logs are viewable by everyone" 
on public.daily_upload_log for select 
using ( true );

create policy "Users can insert their own logs" 
on public.daily_upload_log for insert 
with check ( auth.uid() = "userId" );

-- 6. Setup realtime
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.whitelist;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.uploads;
