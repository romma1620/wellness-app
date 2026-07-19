-- ============================================================
--  aura · wellness tracker — схема БД, RLS та Storage
--  Виконай цей файл повністю у Supabase → SQL Editor.
-- ============================================================

-- ---------- ENUM тем ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'theme_name') then
    create type theme_name as enum ('peach', 'mint', 'lavender');
  end if;
end$$;

-- ============================================================
--  profiles
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text,
  avatar_url    text,
  height        numeric,            -- см
  target_weight numeric,            -- кг
  theme         theme_name not null default 'peach',
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Автостворення профілю при реєстрації
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  daily_logs — один запис на користувача на дату
-- ============================================================
create table if not exists public.daily_logs (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  weight   numeric,
  kcal     integer,
  protein  numeric,
  fat      numeric,
  carbs    numeric,
  water    smallint check (water is null or (water >= 0 and water <= 8)),
  steps    integer,
  sport    text,
  care     text,
  comment  text,
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_logs enable row level security;

drop policy if exists "daily_logs_all_own" on public.daily_logs;
create policy "daily_logs_all_own" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists daily_logs_user_date_idx
  on public.daily_logs (user_id, date desc);

-- ============================================================
--  measurements — заміри тіла
-- ============================================================
create table if not exists public.measurements (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date    date not null,
  waist   numeric,   -- талія
  hips    numeric,   -- стегна
  chest   numeric,   -- груди
  leg     numeric,   -- обхват ноги
  arm     numeric,   -- обхват руки
  created_at timestamptz not null default now()
);

alter table public.measurements enable row level security;

drop policy if exists "measurements_all_own" on public.measurements;
create policy "measurements_all_own" on public.measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists measurements_user_date_idx
  on public.measurements (user_id, date desc);

-- ============================================================
--  rewards — сходинки ваги з винагородами
-- ============================================================
create table if not exists public.rewards (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  weight   numeric not null,
  gift     text not null,
  achieved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.rewards enable row level security;

drop policy if exists "rewards_all_own" on public.rewards;
create policy "rewards_all_own" on public.rewards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists rewards_user_weight_idx
  on public.rewards (user_id, weight desc);

-- ============================================================
--  Storage: bucket для аватарок
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Файли лежать у теці users/<uid>/... — доступ лише до своєї теки
drop policy if exists "avatars_read_public" on storage.objects;
create policy "avatars_read_public" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
