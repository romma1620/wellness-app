# План: трекінг менструального циклу у wellness-апці

Стек: **Next.js (App Router) + Supabase + recharts**.
Мета: додати трекінг циклу, прогнози, і інтегрувати дані циклу з наявними метриками (вага, тренування, кроки, вода).

---

## 0. Рекомендовані бібліотеки

| Лібка | Навіщо |
|---|---|
| `date-fns` | вся робота з датами (диференціали днів, форматування, інтервали). Легка, tree-shakeable |
| `react-day-picker` | база для кастомного календаря циклу — повністю кастомізується через modifiers, headless-підхід |
| `zod` | валідація вводу на server actions і форм |
| `@tanstack/react-query` | кеш і мутації для записів циклу (optimistic updates при тапі по дню) — якщо ще не використовується в проєкті |

recharts вже є — його вистачає для графіків з фазами (через `ReferenceArea`).
**Не** тягнути важкі calendar-лібки (FullCalendar тощо) — react-day-picker + кастомні modifiers покривають усе.

---

## 1. Модель даних (Supabase)

Ключовий принцип: **юзерка логує тільки денні записи** (кровотеча, симптоми, настрій). **Цикли — derived-сутність**, яку ми перераховуємо з цих записів. Це робить безпечним редагування заднім числом.

### 1.1 SQL-схема

```sql
-- Денні записи циклу
create table cycle_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  flow text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms text[] default '{}',        -- 'cramps','headache','bloating','breast_tenderness','acne','back_pain','fatigue','nausea'
  mood text check (mood in ('great', 'good', 'neutral', 'low', 'bad')),
  energy smallint check (energy between 1 and 5),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

-- Derived-цикли (перераховуються тригером/функцією після зміни entries)
create table cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,            -- перший день менструації
  end_date date,                       -- день перед стартом наступного циклу; null = поточний цикл
  period_length smallint,              -- к-сть днів кровотечі
  cycle_length smallint,               -- заповнюється, коли цикл завершено
  unique (user_id, start_date)
);

-- Налаштування фічі (опт-ін, онбординг)
create table cycle_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean default false,
  typical_cycle_length smallint default 28,   -- з онбордингу, поки нема історії
  typical_period_length smallint default 5,
  discreet_notifications boolean default false, -- нейтральні тексти пушів
  created_at timestamptz default now()
);
```

### 1.2 RLS (обов'язково)

```sql
alter table cycle_entries enable row level security;
alter table cycles enable row level security;
alter table cycle_settings enable row level security;

-- однакові політики для всіх трьох таблиць:
create policy "own rows" on cycle_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- (повторити для cycles і cycle_settings)
```

### 1.3 Derivation циклів

Правило: запис із `flow` (не null), перед яким **немає flow-запису протягом попередніх 2+ днів**, — це початок нового циклу. Дні кровотечі з розривом ≤2 дні належать до однієї менструації (spotting посеред циклу циклом не вважається, якщо це 1 ізольований день — позначай як spotting, не старт).

Реалізація: **Postgres-функція** `recalculate_cycles(p_user_id uuid)`, яку викликає server action після кожної мутації `cycle_entries` (простіше дебажити, ніж тригер; можна пізніше перенести в тригер).

Алгоритм функції:
1. Вибрати всі дати з `flow is not null and flow != 'spotting'` (spotting враховувати тільки якщо прилягає до інших flow-днів), відсортувати.
2. Згрупувати в менструації: розрив >2 днів = нова менструація.
3. Менструація = початок циклу. `end_date` циклу = день перед стартом наступного. `cycle_length = end_date - start_date + 1`.
4. Повністю перезаписати `cycles` для юзера (delete + insert) — таблиця маленька, це найпростіше й без edge cases.

---

## 2. Прогнозування

### 2.1 Алгоритм (утиліта `lib/cycle/predict.ts`)

```
input: завершені цикли (останні 6), typical_cycle_length з settings
1. Якщо завершених циклів < 2 → використовувати typical_cycle_length, confidence = 'low'
2. Інакше: avg = середнє cycle_length останніх 3–6 циклів
   sd = стандартне відхилення
3. Прогноз наступної менструації = start останнього циклу + round(avg)
4. Вікно прогнозу = ±max(2, round(sd)) днів
   confidence: sd <= 2 → 'high', sd <= 4 → 'medium', інакше 'low'
5. Овуляція = прогнозований старт НАСТУПНОГО циклу − 14 днів
   (лютеїнова фаза стабільна ~14 днів; НЕ рахувати «14-й день від початку»)
6. Фертильне вікно = [овуляція − 5; овуляція + 1]
```

### 2.2 Фази циклу (для інтеграцій і підказок)

```
menstrual:        день 1 → кінець кровотечі
follicular:       кінець кровотечі → овуляція − 1
ovulation:        овуляція ± 1 день
luteal:           овуляція + 2 → кінець циклу
late_luteal (PMS): останні 4–5 днів циклу (підмножина luteal)
```

Утиліта `getPhaseForDate(date, cycles, prediction): Phase` — використовується скрізь: календар, графік ваги, підказки.

### 2.3 Нерегулярність — важливо

- Якщо `sd > 4` — **не показувати одну дату**. Показувати діапазон: «Менструація очікується 12–17 березня» + позначку низької впевненості.
- Якщо цикл > avg + 2*sd (затримка) — нейтральний меседж («цикл довший за звичний»), без панічних формулювань.

---

## 3. Структура коду (Next.js App Router)

```
app/
  cycle/
    page.tsx                    // головний екран циклу: календар + статус
    insights/page.tsx           // інсайти (фаза 3)
  api/ ... або server actions
lib/
  cycle/
    derive.ts                   // клієнтські хелпери навколо derived-даних
    predict.ts                  // прогнозування (чиста функція — легко тестувати)
    phases.ts                   // getPhaseForDate, PHASE_COLORS, PHASE_LABELS
    types.ts
components/
  cycle/
    CycleCalendar.tsx           // react-day-picker з modifiers
    DaySheet.tsx                // bottom sheet логування дня
    SymptomChips.tsx
    FlowSelector.tsx
    CycleStatusCard.tsx         // «День 14 · Фолікулярна фаза»
    PredictionBanner.tsx
    PhaseAwareWeightChart.tsx   // recharts + ReferenceArea фаз
actions/
  cycle.ts                      // server actions: upsertEntry, deleteEntry, updateSettings
```

Server actions з zod-валідацією; після мутації — виклик `recalculate_cycles` RPC і `revalidatePath('/cycle')`.

---

## 4. UI — детальний опис

### 4.1 Головний екран `/cycle`

Зверху вниз:

1. **CycleStatusCard** — велика картка стану:
   - «День 16 · Лютеїнова фаза»
   - підзаголовок: «Менструація очікується через ~12 днів (24–27 серпня)»
   - колір/градієнт картки відповідає фазі.
2. **CycleCalendar** — місячний календар.
3. **Кнопка/FAB «Відмітити сьогодні»** → відкриває DaySheet.
4. Нижче — секція коротких підказок фази (тренування/вода), 1–2 картки.

### 4.2 CycleCalendar (react-day-picker)

Кольорове кодування через `modifiers` + `modifiersClassNames`:

| Стан дня | Вигляд |
|---|---|
| Менструація (факт) | заливка (насичений рожевий/червоний), інтенсивність flow — прозорістю або крапками 1–4 |
| Прогноз менструації | той самий колір, але пунктирна обводка / світла заливка |
| Овуляція (прогноз) | обводка бірюзова/фіолетова |
| Фертильне вікно | легкий тінт фону |
| День із записом (симптоми/настрій без flow) | маленька крапка під числом |
| Сьогодні | жирна обводка |

Взаємодія:
- **Тап по дню** → відкриває DaySheet для цієї дати (можна логувати заднім числом).
- Легенда під календарем (згортається).

### 4.3 DaySheet — логування дня (bottom sheet / drawer)

Головна вимога: **швидкість, 2–3 тапи**. Жодних довгих форм.

Порядок блоків:
1. **FlowSelector** — 4 великі кнопки-сегменти: spotting / слабко / середньо / сильно (+ стан «немає»). Іконки-краплі зростаючого розміру.
2. **SymptomChips** — чіпси мультивибору: судоми, головний біль, здуття, чутливість грудей, біль у спині, акне, втома, нудота.
3. **Настрій** — 5 емодзі-кнопок.
4. **Енергія** — 5 сегментів.
5. Нотатка (опційно, згорнута за замовчуванням).

Автозбереження на кожен тап (optimistic update через react-query), без кнопки «Зберегти». Toast не потрібен — стан видно одразу.

### 4.4 Інтеграція з графіком ваги (PhaseAwareWeightChart)

Найцінніша фіча. На наявний recharts-графік ваги додати:

```tsx
// фонові смуги фаз
{phaseRanges.map(r => (
  <ReferenceArea
    key={r.start}
    x1={r.start} x2={r.end}
    fill={PHASE_COLORS[r.phase]}
    fillOpacity={0.08}
    ifOverflow="hidden"
  />
))}
// вертикальні лінії стартів циклів
{cycleStarts.map(d => (
  <ReferenceLine key={d} x={d} stroke="#e11d48" strokeDasharray="3 3" />
))}
```

- Тумблер над графіком: «Показувати фази циклу» (off за замовчуванням, стан у settings).
- Кастомний Tooltip: до ваги додає «День циклу 24 · Лютеїнова фаза».
- Якщо поточна дата у late_luteal/menstrual і вага зросла ≤2 кг від середньої за фолікулярну фазу → бейдж під графіком: «Ймовірна затримка води — типово для цієї фази. Порівнюй із тим самим днем минулого циклу».
- Додаткова метрика (фаза 3): **середня вага по фазах за останні 3 цикли** — маленький BarChart.

### 4.5 Підказки по фазах (карткові, м'які формулювання)

Словник у `lib/cycle/tips.ts`, ключ — фаза:

- **menstrual**: легкі тренування/ходьба ок; пити більше води; залізовмісні продукти.
- **follicular**: пік енергії — гарний час для важких/інтенсивних тренувань і PR.
- **ovulation**: висока енергія; увага до техніки (звʼязки еластичніші).
- **luteal**: сили може бути менше — нормально знизити інтенсивність; більше білка.
- **late_luteal**: можлива затримка води й тяга до їжі — це фізіологія, не «зрив»; вага на терезах ≠ жир.

Тон: «багато жінок у цій фазі відчувають…», ніколи не директивно.

### 4.6 Онбординг фічі (3 кроки, modal/route `/cycle/onboarding`)

1. Опт-ін + приватність: коротко «дані шифруються, нікому не передаються, можна видалити будь-коли» + лінк на політику.
2. «Коли почалась остання менструація?» — календар.
3. «Типова довжина циклу?» — слайдер 21–40, дефолт 28 (+ «не знаю» → 28).

Після цього одразу малюємо перший прогноз.

### 4.7 Пуші (опційно, фаза 2)

- За 2 дні до прогнозованого старту: «Менструація очікується ~24 серпня».
- `discreet_notifications = true` → нейтральний текст: «Загляни в апку 🙂».

---

## 5. Інсайти (фаза 3, коли є ≥3 цикли)

Сторінка `/cycle/insights`:

1. **Статистика циклу**: середня довжина, довжина менструації, регулярність (sd), історія довжин циклів (BarChart).
2. **Кореляції з наявними метриками** (обчислювати on-demand server-side):
   - середні кроки по фазах;
   - середня енергія на тренуваннях по фазах;
   - дельта ваги luteal vs follicular;
   - найчастіші симптоми і в які дні циклу вони зʼявляються.
3. Формулювання інсайтів: «У менструальні дні твої кроки в середньому на 18% менші» — тільки якщо різниця статистично помітна (>10–15%), інакше не показувати шум.

---

## 6. Приватність і безпека (не опційно)

- [ ] RLS на всі таблиці (див. 1.2).
- [ ] Дані циклу **не** відправляти в жодну аналітику (перевірити event properties у наявних трекерах).
- [ ] Кнопка «Видалити всі дані циклу» в налаштуваннях: `delete from cycle_entries/cycles/cycle_settings where user_id = auth.uid()` — одним server action, з підтвердженням.
- [ ] Вимкнення фічі (`enabled=false`) ховає її з UI, але не видаляє дані (окремо від видалення).
- [ ] Дисклеймер на екрані прогнозів: «Прогнози орієнтовні. Це не медичний інструмент і не метод контрацепції».
- [ ] Discreet-режим для пушів.

---

## 7. План реалізації по фазах (чекліст для Claude Code)

### Фаза 1 — MVP
- [ ] Міграції: `cycle_entries`, `cycles`, `cycle_settings` + RLS
- [ ] Postgres-функція `recalculate_cycles`
- [ ] `lib/cycle/predict.ts` + `phases.ts` (чисті функції + unit-тести на derivation і прогноз: регулярні цикли, нерегулярні, spotting, редагування заднім числом)
- [ ] Server actions: `upsertCycleEntry`, `deleteCycleEntry`, `updateCycleSettings`
- [ ] Онбординг (4.6)
- [ ] `CycleCalendar` + `DaySheet` (4.2–4.3)
- [ ] `CycleStatusCard` + `PredictionBanner`
- [ ] Дисклеймер + видалення даних

### Фаза 2 — інтеграція
- [ ] `PhaseAwareWeightChart` (4.4)
- [ ] Підказки по фазах (4.5)
- [ ] Пуші + discreet-режим
- [ ] Прогноз як діапазон при нерегулярності (2.3)

### Фаза 3 — інсайти
- [ ] `/cycle/insights` (5)
- [ ] Кореляції з кроками/тренуваннями/вагою
- [ ] Середня вага по фазах

---

## 8. Тести, які точно потрібні

1. Derivation: два flow-дні з розривом 1 день = одна менструація; розрив 5 днів = дві.
2. Ізольований spotting посеред циклу не створює новий цикл.
3. Редагування заднім числом коректно перебудовує цикли.
4. Прогноз: <2 циклів → typical_cycle_length; sd великий → широке вікно + low confidence.
5. Овуляція рахується від прогнозованого старту наступного циклу − 14.
6. RLS: юзер А не бачить записи юзера Б.
