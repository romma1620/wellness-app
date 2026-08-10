-- ============================================================
--  aura · wellness tracker — схема БД, RLS та Storage
--  Виконай цей файл повністю у Supabase → SQL Editor.
-- ============================================================

-- ---------- ENUM тем ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'theme_name') then
    create type theme_name as enum ('peach', 'mint', 'lavender', 'pink');
  end if;
end$$;

-- Для БД, створених до появи теми "pink" (idempotent, PostgreSQL 12+).
alter type theme_name add value if not exists 'pink';

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

-- ============================================================
--  Тренування: exercises / routines / workouts / sets
-- ============================================================

-- ---------- Довідник вправ ----------
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  muscle_group text,   -- 'ноги'|'спина'|'груди'|'плечі'|'руки'|'кор'|'інше' | null
  created_at   timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.exercises enable row level security;

drop policy if exists "exercises_all_own" on public.exercises;
create policy "exercises_all_own" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists exercises_user_idx on public.exercises (user_id);

-- ---------- Шаблони тренувань ----------
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.routines enable row level security;

drop policy if exists "routines_all_own" on public.routines;
create policy "routines_all_own" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists routines_user_idx on public.routines (user_id);

-- ---------- Вправи в шаблоні ----------
create table if not exists public.routine_exercises (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position    integer not null default 0
);

alter table public.routine_exercises enable row level security;

drop policy if exists "routine_exercises_own" on public.routine_exercises;
create policy "routine_exercises_own" on public.routine_exercises
  for all using (
    exists (select 1 from public.routines r
            where r.id = routine_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.routines r
            where r.id = routine_id and r.user_id = auth.uid())
  );

create index if not exists routine_exercises_routine_idx
  on public.routine_exercises (routine_id);

-- ---------- Сесія тренування ----------
create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  routine_id uuid references public.routines(id) on delete set null,
  name       text,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.workouts enable row level security;

drop policy if exists "workouts_all_own" on public.workouts;
create policy "workouts_all_own" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);

-- ---------- Підходи ----------
create table if not exists public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number  integer not null,
  weight      numeric,   -- null для вправ з власною вагою
  reps        integer not null,
  created_at  timestamptz not null default now()
);

alter table public.workout_sets enable row level security;

drop policy if exists "workout_sets_own" on public.workout_sets;
create policy "workout_sets_own" on public.workout_sets
  for all using (
    exists (select 1 from public.workouts w
            where w.id = workout_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workouts w
            where w.id = workout_id and w.user_id = auth.uid())
  );

create index if not exists workout_sets_workout_idx
  on public.workout_sets (workout_id);

-- ---------- Агрегати для екрана «Тренування» ----------

-- Тоннаж одного підходу. Дзеркалить setTonnage() з src/lib/workouts.ts:
-- порожня вага = власна вага, тож внесок дорівнює кількості повторів.
create or replace function public.set_tonnage(p_weight numeric, p_reps integer)
returns numeric
language sql
immutable
as $$
  select case
           when p_reps is null then 0
           when p_weight is null then p_reps::numeric
           else p_weight * p_reps
         end;
$$;

-- Місячні підсумки користувача, найновіші спершу.
-- Потрібні, щоб малювати заголовки груп і рахувати пагінацію,
-- не тягнучи весь архів на клієнт.
create or replace function public.workout_month_totals()
returns table (month_start date, sessions integer, tonnage numeric)
language sql
stable
security invoker
as $$
  select date_trunc('month', w.date)::date,
         count(distinct w.id)::integer,
         coalesce(sum(public.set_tonnage(s.weight, s.reps)), 0)
  from public.workouts w
  left join public.workout_sets s on s.workout_id = w.id
  where w.user_id = auth.uid()
  group by 1
  order by 1 desc;
$$;

-- Вправи, що реально трапляються в сесіях, з датою останнього використання.
-- PostgREST не вміє distinct по вкладеному ресурсі, тому це RPC.
create or replace function public.used_exercises()
returns table (id uuid, name text, muscle_group text, last_used date)
language sql
stable
security invoker
as $$
  select e.id, e.name, e.muscle_group, max(w.date)
  from public.exercises e
  join public.workout_sets s on s.exercise_id = e.id
  join public.workouts w on w.id = s.workout_id
  where e.user_id = auth.uid()
  group by e.id, e.name, e.muscle_group
  order by e.name;
$$;

-- Рекорд кожної вправи: підхід із найбільшою вагою за всю історію юзера.
-- Порядок дзеркалить bestSet() зі src/lib/workouts.ts (макс. вага, тай-брейк —
-- більше повторів); третій ключ по даті потрібен лише для детермінованості
-- achieved_on, коли та сама вага × повтори траплялися в кількох сесіях.
--
-- p_exclude_workout виключає сесію, яку зараз редагують: її підходи вже в базі,
-- і без виключення рекордом вважалося б рівно те, що юзер щойно ввів.
create or replace function public.exercise_maxes(p_exclude_workout uuid default null)
returns table (exercise_id uuid, weight numeric, reps integer, achieved_on date)
language sql
stable
security invoker
as $$
  select distinct on (s.exercise_id) s.exercise_id, s.weight, s.reps, w.date
  from public.workout_sets s
  join public.workouts w on w.id = s.workout_id
  where w.user_id = auth.uid()
    and s.weight is not null
    and (p_exclude_workout is null or w.id <> p_exclude_workout)
  order by s.exercise_id, s.weight desc, s.reps desc, w.date desc;
$$;

-- Під used_exercises(), exercise_maxes() і вибірку сетів однієї вправи для графіка.
create index if not exists workout_sets_exercise_idx
  on public.workout_sets (exercise_id);

-- ============================================================
--  Трекінг циклу: cycle_entries / cycle_settings
--
--  Юзерка логує лише денні записи. Цикли — derived-сутність:
--  вони не зберігаються, а перераховуються з записів у
--  src/lib/cycle/derive.ts. Тому редагування заднім числом
--  безпечне за побудовою — немає другої копії правди, яка
--  могла б розійтися з денними записами.
-- ============================================================

create table if not exists public.cycle_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  -- null = кровотечі не було; порядок сили: spotting < light < medium < heavy
  flow       text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  -- ключі з SYMPTOMS у src/lib/cycle/types.ts
  symptoms   text[] not null default '{}',
  mood       text check (mood in ('great', 'good', 'neutral', 'low', 'bad')),
  energy     smallint check (energy is null or (energy >= 1 and energy <= 5)),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.cycle_entries enable row level security;

drop policy if exists "cycle_entries_all_own" on public.cycle_entries;
create policy "cycle_entries_all_own" on public.cycle_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists cycle_entries_user_date_idx
  on public.cycle_entries (user_id, date desc);

-- Опт-ін і налаштування фічі. Рядок зʼявляється лише після онбордингу,
-- тому «немає рядка» = фіча ніколи не була ввімкнена.
create table if not exists public.cycle_settings (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  enabled               boolean not null default false,
  -- межі мусять збігатися з CYCLE_LENGTH_MIN/MAX у src/lib/cycle/types.ts
  typical_cycle_length  smallint not null default 28
                          check (typical_cycle_length between 21 and 60),
  typical_period_length smallint not null default 5
                          check (typical_period_length between 1 and 12),
  show_fertile_window   boolean not null default true,
  -- фази як фонові смуги на графіку ваги в аналітиці
  phase_bands_in_charts boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Межі могли змінитися вже після створення таблиці, а `create table if not
-- exists` наявну не чіпає. Перевстановлюємо CHECK явно, щоб повторний прогін
-- цього файлу оновлював обмеження, а не мовчки лишав старе.
alter table public.cycle_settings
  drop constraint if exists cycle_settings_typical_cycle_length_check;
alter table public.cycle_settings
  add constraint cycle_settings_typical_cycle_length_check
  check (typical_cycle_length between 21 and 60);

alter table public.cycle_settings enable row level security;

drop policy if exists "cycle_settings_all_own" on public.cycle_settings;
create policy "cycle_settings_all_own" on public.cycle_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
