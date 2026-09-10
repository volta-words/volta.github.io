-- Cornwall Bus Journey Planner schema

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  home_stop_id text not null,
  college_stop_id text not null,
  home_lat double precision,
  home_lng double precision,
  college_lat double precision,
  college_lng double precision,
  display_name text,
  weight_speed integer not null default 50 check (weight_speed between 0 and 100),
  weight_changes integer not null default 25 check (weight_changes between 0 and 100),
  weight_stops integer not null default 25 check (weight_stops between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stop_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stop_id text not null,
  rating text not null check (rating in ('prefer', 'neutral', 'avoid')),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, stop_id)
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  arrive_by time,
  leave_after time,
  created_at timestamptz not null default now(),
  unique (user_id, day_of_week)
);

alter table public.profiles enable row level security;
alter table public.stop_preferences enable row level security;
alter table public.schedules enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can view own stop preferences"
  on public.stop_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own stop preferences"
  on public.stop_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own stop preferences"
  on public.stop_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own stop preferences"
  on public.stop_preferences for delete
  using (auth.uid() = user_id);

create policy "Users can view own schedules"
  on public.schedules for select
  using (auth.uid() = user_id);

create policy "Users can insert own schedules"
  on public.schedules for insert
  with check (auth.uid() = user_id);

create policy "Users can update own schedules"
  on public.schedules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own schedules"
  on public.schedules for delete
  using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
