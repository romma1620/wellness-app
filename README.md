# aura · щоденник тіла і здоровʼя

Mobile-first PWA для трекінгу ваги, харчування, води, кроків, замірів тіла та цілей-винагород. Українською мовою.

**Стек:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + Storage) · Recharts · Vercel.

---

## 1. Швидкий старт

```bash
npm install
cp .env.local.example .env.local   # і встав свої значення (див. нижче)
npm run dev
```

Відкрий http://localhost:3000 — перекине на `/login`.

## 2. Налаштування Supabase

1. Створи проєкт на [supabase.com](https://supabase.com).
2. **SQL Editor** → New query → встав увесь вміст `supabase/schema.sql` → **Run**.
   Це створить таблиці (`profiles`, `daily_logs`, `measurements`, `rewards`),
   увімкне **Row Level Security** (кожен бачить лише свої дані), тригер
   автостворення профілю та bucket `avatars` з політиками доступу.
3. **Project Settings → API** — скопіюй `Project URL` і `anon public` ключ у `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

4. **Authentication → Providers → Email** — увімкнено за замовчуванням.
   Для миттєвого входу без листа-підтвердження вимкни **Confirm email**
   (Authentication → Sign In / Providers). Інакше після реєстрації користувач
   отримає лист і має підтвердити пошту перед входом.

## 3. Схема БД

| Таблиця        | Поля |
|----------------|------|
| `profiles`     | id (=auth.uid), name, avatar_url, height, target_weight, theme (peach/mint/lavender), created_at |
| `daily_logs`   | id, user_id, date (унікальна на користувача), weight, kcal, protein, fat, carbs, water (0–8), steps, sport, care, comment |
| `measurements` | id, user_id, date, waist, hips, chest, leg, arm |
| `rewards`      | id, user_id, weight, gift, achieved |

RLS: усі політики фільтрують за `auth.uid() = user_id`. Storage-бакет `avatars`
дозволяє запис лише у власну теку `<uid>/…`.

## 4. Сторінки

- **/login** — вхід / реєстрація (перемикач), Supabase Auth. Решта сторінок захищені middleware.
- **/** (Сьогодні) — форма дня з **автозбереженням** (upsert за `user_id+date`), навігація по датах зі стрілками та календарем.
- **/analytics** — перемикач Тиждень/Місяць, графік ваги + ковзне середнє за 7 днів (пунктир), картки-порівняння з попереднім періодом (дельта %, стрілка, колір), міні-графіки БЖВ і кроків. Дні без даних пропускаються.
- **/measurements** — форма замірів, картки з динамікою, лінійні графіки, банер-нагадування якщо минуло >14 днів.
- **/goals** — драбинка ваги з винагородами (CRUD). Сходинка досягнута, коли мінімальна вага за останні 7 днів ≤ цільової; прогрес-бар до наступної.
- **/settings** — аватар (upload у Storage), імʼя, зріст, цільова вага, вибір теми, логаут.

## 5. Теми

Три теми (`peach`, `mint`, `lavender`) реалізовані через CSS-змінні на
`html[data-theme]` (див. `src/app/globals.css`). Вибір зберігається в
`profiles.theme` і застосовується миттєво без перезавантаження. Щоб уникнути
мигання, тема підтягується з `localStorage` інлайн-скриптом до першого рендера.

## 6. Валідація та формат чисел

- Числа приймаються з комою **і** з крапкою (`65,8` = `65.8`) — див. `parseNum` у `src/lib/utils.ts`.
- Вага 30–200, вода 0–8, кроки 0–50 (тис.).

## 7. PWA

- `public/manifest.webmanifest` + іконки в `public/icons`.
- Service worker `public/sw.js` (реєструється лише у production) — базове офлайн-кешування.
- На телефоні: **Поділитися → Додати на екран «Додому»**.

## 8. Деплой на Vercel

1. Залий репозиторій на GitHub.
2. На [vercel.com](https://vercel.com) → **New Project** → імпортуй репозиторій.
3. У **Environment Variables** додай `NEXT_PUBLIC_SUPABASE_URL` і `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Deploy**. Далі у Supabase → Authentication → URL Configuration додай свій
   Vercel-домен у **Site URL** та **Redirect URLs**.

## 9. Команди

```bash
npm run dev        # локальна розробка
npm run build      # production-збірка
npm run start      # запуск зібраного
npm run typecheck  # перевірка типів
npm run lint       # ESLint
```
