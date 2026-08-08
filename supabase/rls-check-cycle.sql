-- ============================================================
--  Перевірка RLS на даних циклу (план, §8.6)
--
--  Доводить, що юзерка А не бачить і не може змінити записи юзерки Б.
--  Виконувати у Supabase → SQL Editor ЦІЛИМ файлом.
--
--  Скрипт не залежить від наявних акаунтів: створює двох тимчасових
--  користувачів, ганяє запити від імені кожного і прибирає за собою.
--  Тестові дані живуть у auth.users із фіксованим email-префіксом, тож
--  видалення каскадом зносить і записи циклу.
--
--  Очікуваний результат — сім рядків, у кожному verdict = ✅.
-- ============================================================

-- Прибирання після можливого невдалого попереднього запуску: якщо DO-блок
-- нижче впаде посередині, скрипт обірветься й тестові юзери лишаться.
delete from auth.users where email like 'rls-check-%@example.test';

-- Результати живуть у temp-таблиці, а не в змінних: вона переживає
-- видалення тестових даних, тому звіт можна вивести вже після прибирання.
drop table if exists rls_result;
create temporary table rls_result (ord int, step text, ok boolean);

-- SQL Editor працює від ролі з bypassrls — під нею політики не діють і
-- перевірка «проходила» б завжди. Нижче ми вдаємо звичайний запит із
-- застосунку (роль authenticated + request.jwt.claims), а щоб під нею
-- лишалась можливість писати звіт — видаємо права на temp-таблицю.
grant all on table rls_result to authenticated;

do $$
declare
  uid_a uuid := gen_random_uuid();
  uid_b uuid := gen_random_uuid();
  seen  int;
  wrote int;
begin
  -- instance_id / aud / role — те, що ставить сам GoTrue; без них рядок
  -- у auth.users не консистентний.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values
    (uid_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-check-a@example.test', '', now(), now()),
    (uid_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-check-b@example.test', '', now(), now());

  -- Дані обох заводимо від привілейованої ролі, щоб перевіряти саме
  -- читання й запис, а не вставку.
  insert into public.cycle_entries (user_id, date, flow, symptoms)
  values (uid_a, '2026-08-01', 'medium', '{cramps}'),
         (uid_b, '2026-08-01', 'heavy',  '{fatigue}');

  insert into public.cycle_settings (user_id, enabled, typical_cycle_length)
  values (uid_a, true, 28),
         (uid_b, true, 31);

  -- ---------- далі все від імені юзерки А ----------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_a, 'role', 'authenticated')::text,
    true
  );

  select count(*) into seen from public.cycle_entries;
  insert into rls_result values (1, 'А бачить лише свій cycle_entries (1 рядок)', seen = 1);

  select count(*) into seen from public.cycle_entries where user_id = uid_b;
  insert into rls_result values (2, 'А не бачить cycle_entries юзерки Б', seen = 0);

  select count(*) into seen from public.cycle_settings;
  insert into rls_result values (3, 'А бачить лише свій cycle_settings (1 рядок)', seen = 1);

  -- UPDATE чужого рядка не кидає помилку: політика робить його невидимим,
  -- тож зачепити 0 рядків і є правильна поведінка.
  update public.cycle_entries set flow = 'spotting' where user_id = uid_b;
  get diagnostics wrote = row_count;
  insert into rls_result values (4, 'А не може змінити запис Б (0 рядків)', wrote = 0);

  delete from public.cycle_entries where user_id = uid_b;
  get diagnostics wrote = row_count;
  insert into rls_result values (5, 'А не може видалити запис Б (0 рядків)', wrote = 0);

  -- А ось запис із чужим user_id мусить впертися у WITH CHECK і впасти.
  begin
    insert into public.cycle_entries (user_id, date, flow) values (uid_b, '2026-09-09', 'light');
    insert into rls_result values (6, 'А не може писати від імені Б', false);
  exception
    when insufficient_privilege then
      insert into rls_result values (6, 'А не може писати від імені Б', true);
  end;

  -- Контрольний крок: політика, що забороняє все, пройшла б усі перевірки
  -- вище й при цьому зламала б застосунок. Свій рядок мусить бути доступним.
  update public.cycle_entries set flow = 'light' where user_id = uid_a;
  get diagnostics wrote = row_count;
  insert into rls_result values (7, 'А редагує власний запис (1 рядок)', wrote = 1);

  reset role;
end$$;

-- Тестові юзери йдуть геть; cycle_entries і cycle_settings — каскадом.
delete from auth.users where email like 'rls-check-%@example.test';

select
  step,
  case when ok then '✅' else '❌ ПРОВАЛ' end as verdict,
  (select case when count(*) filter (where not ok) = 0
               then 'усі перевірки пройдено'
               else count(*) filter (where not ok) || ' ПРОВАЛЕНО' end
   from rls_result) as summary
from rls_result
order by ord;
