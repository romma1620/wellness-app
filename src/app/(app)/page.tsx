"use client";

import {
  NumberField,
  PresetChips,
  SaveIndicator,
  TagInput,
  useDecimalBuffer,
  type SaveState,
} from "@/components/inputs";
import { Icon } from "@/components/icons";
import { Card, DateField, ErrorBanner, PageTitle, SectionLabel, Textarea } from "@/components/ui";
import { DaySkeleton } from "@/components/DaySkeleton";
import { CycleRow } from "@/components/today/CycleRow";
import { MacroBar } from "@/components/today/MacroBar";
import { Sparkline } from "@/components/today/Sparkline";
import { StatTile } from "@/components/today/StatTile";
import { WaterStepper } from "@/components/today/WaterStepper";
import { WeekStrip } from "@/components/today/WeekStrip";
import { CARE_PRESETS } from "@/lib/care";
import { dailyGoals, goalFraction, goalSub } from "@/lib/goals";
import {
  applySaved,
  diffDay,
  EMPTY_DAY,
  formFromRow,
  hasChanges,
  type DailyForm,
  type DailyPatch,
} from "@/lib/daily-log";
import { loadDayWindow, saveDayPatch } from "@/lib/daily-log-db";
import { useProfile, useRecentWeights } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { cn, fmt, fmtInt, humanDate, isToday, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAVE_DEBOUNCE_MS = 700;
/** Скільки останніх ваг іде в міні-графік. */
const SPARK_POINTS = 14;

/**
 * Форма зберігається разом із датою, якій вона належить: збереження бере дату
 * звідси, а не з поточного рендера, тож дані одного дня не можуть потрапити в інший.
 * `loaded` — знімок із сервера, база для обчислення того, що реально змінилось.
 */
type DayState = {
  date: string;
  loaded: DailyForm;
  form: DailyForm;
};

export default function TodayPage() {
  const supabase = useMemo(() => createClient(), []);
  const uid = useUid();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [day, setDay] = useState<DayState | null>(null);
  const [save, setSave] = useState<SaveState>("idle");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ date: string; patch: DailyPatch } | null>(null);

  const dayQ = useQuery({
    queryKey: ["diary", uid, "day", date],
    queryFn: () => loadDayWindow(supabase, uid, date),
  });

  const commit = useCallback(
    async (target: string, patch: DailyPatch) => {
      try {
        await saveDayPatch(supabase, uid, target, patch);
        // збережене стає новою базою, щоб не потрапити в наступний патч
        setDay((d) => (d && d.date === target ? { ...d, loaded: applySaved(d.loaded, patch) } : d));
        setSave("saved");
        // аналітика, інсайти, прогноз і кеш цього ж дня читають ті самі рядки
        void queryClient.invalidateQueries({ queryKey: ["diary", uid] });
      } catch {
        setSave("error");
      }
    },
    [supabase, uid, queryClient],
  );

  /** Негайно відправити відкладене збереження: зміна дня, згортання застосунку, unmount. */
  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    void commit(p.date, p.patch);
  }, [commit]);

  useEffect(() => {
    flush(); // незбережене з попереднього дня йде в базу, а не в смітник
  }, [date, flush]);

  // Стан попереднього дня ніколи не читається під новою датою: похідна
  // замість скидання в ефекті, тож помилка завантаження нової дати не
  // покаже форму старої, а автозбереження не порахує дифф не з тим днем.
  const activeDay = day && day.date === date ? day : null;

  // Форма ініціалізується зі знімка сервера. Фонова ревалідація має право
  // замінити її, лише поки юзер нічого не встиг надрукувати й нема
  // невідправленого патча — інакше свіжий знімок затер би введене.
  useEffect(() => {
    const win = dayQ.data;
    if (!win) return;
    setDay((d) => {
      if (d && d.date === date && (hasChanges(diffDay(d.loaded, d.form)) || pending.current)) {
        return d;
      }
      const form = formFromRow(win.current);
      return { date, loaded: form, form };
    });
  }, [dayQ.data, date]);

  const loading = dayQ.isPending;
  const baselineWeight = dayQ.data?.baselineWeight ?? null;
  const loadError = dayQ.isError ? "Не вдалося завантажити день. Перевір зʼєднання." : null;

  // Автозбереження (debounce). Таймер ніколи не скасовується завантаженням —
  // тільки замінюється новим патчем того самого дня.
  useEffect(() => {
    if (!activeDay) return;
    const patch = diffDay(activeDay.loaded, activeDay.form);
    if (!hasChanges(patch)) return; // load або повернення значення назад

    if (pending.current && pending.current.date !== activeDay.date) flush();
    pending.current = { date: activeDay.date, patch };

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, SAVE_DEBOUNCE_MS);
  }, [activeDay, flush]);

  // Згортання застосунку чи вихід зі сторінки не мають зʼїдати останні 700 мс.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const form = activeDay?.form ?? EMPTY_DAY;
  // Індикатор рахується з реального стану форми, а не з окремого прапорця,
  // тому не може зависнути в «Збереження…» після перемикання дня.
  const dirty = activeDay ? hasChanges(diffDay(activeDay.loaded, activeDay.form)) : false;

  const set = <K extends keyof DailyForm>(key: K, value: DailyForm[K]) =>
    setDay((d) => (d && d.date === date ? { ...d, form: { ...d.form, [key]: value } } : d));

  const weekDelta =
    form.weight != null && baselineWeight != null ? form.weight - baselineWeight : null;

  const weightInput = useDecimalBuffer(form.weight, (v) => set("weight", v), {
    min: 30,
    max: 200,
  });
  const stepsInput = useDecimalBuffer(
    form.steps,
    (v) => set("steps", v == null ? null : Math.round(v)),
    { min: 0, max: 100000 },
  );

  // Щоденні цілі живуть у профілі; запит спільний із «Цілями» й прогнозом,
  // тож окремої мережевої роботи плитки не додають. Поки профіль їде, цілі
  // порожні — кільця показують доріжку, а не хибний прогрес.
  const profileQ = useProfile();
  const goals = dailyGoals(profileQ.data);

  // Міні-графік ваги: спільна вибірка з прогнозом і «Цілями», лише хвіст.
  const weightsQ = useRecentWeights();
  const sparkValues = useMemo(
    () => (weightsQ.data ?? []).slice(-SPARK_POINTS).map((w) => w.weight),
    [weightsQ.data],
  );

  // Тап по плитці ставить курсор у відповідне поле; NumberField не
  // прокидає ref, тож інпут шукаємо всередині обгортки.
  const kcalWrap = useRef<HTMLDivElement>(null);
  const focusKcal = () => kcalWrap.current?.querySelector("input")?.focus();

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle
        subtitle={humanDate(date)}
        right={
          <>
            <SaveIndicator state={dirty ? "saving" : save} />
            <DateField
              value={date}
              onChange={setDate}
              max={todayISO()}
              label="Обрати дату"
              className="!w-auto shrink-0"
            >
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line bg-surface text-muted transition active:scale-95">
                <Icon name="calendar" size={15} strokeWidth={1.7} />
              </span>
            </DateField>
          </>
        }
      >
        {isToday(date) ? "Сьогодні" : "День"}
      </PageTitle>

      <WeekStrip date={date} onSelect={setDate} />

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {loading ? (
        <DaySkeleton />
      ) : (
        <>
          {/* Вага */}
          <Card>
            <SectionLabel
              icon="scale"
              className="mb-0"
              right={
                weekDelta != null && Math.abs(weekDelta) >= 0.05 ? (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-[10px] py-1 text-[11.5px] font-semibold",
                      weekDelta < 0
                        ? "bg-[color:color-mix(in_oklab,var(--pos)_14%,transparent)] text-pos"
                        : "bg-[color:color-mix(in_oklab,var(--warn)_14%,transparent)] text-warn",
                    )}
                  >
                    <Icon name={weekDelta < 0 ? "arrowDown" : "arrowUp"} size={11} strokeWidth={2} />
                    {fmt(Math.abs(weekDelta), 1)} кг за тиждень
                  </span>
                ) : undefined
              }
            >
              Вага
            </SectionLabel>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <input
                    {...weightInput.inputProps}
                    placeholder="—"
                    aria-label="Вага, кг"
                    className="w-full min-w-0 bg-transparent p-0 text-[44px] font-normal leading-none tracking-[-.01em] text-ink outline-none placeholder:text-muted"
                  />
                  <span className="shrink-0 text-[14px] font-medium text-muted">кг</span>
                </div>
                {weightInput.outOfRange && (
                  <div className="mt-1 text-[11px] font-semibold text-neg">Допустимо 30–200</div>
                )}
              </div>
              <Sparkline values={sparkValues} />
            </div>
            <CycleRow date={date} />
          </Card>

          {/* Плитки: калорії, кроки, вода. Цілі — з профілю; не задана ціль
              лишає кільце доріжкою, але сам показник пишеться далі. */}
          <div className="grid grid-cols-3 gap-[10px]">
            <StatTile
              icon="bolt"
              frac={goalFraction(form.kcal, goals.kcal)}
              value={form.kcal != null ? fmtInt(form.kcal) : "—"}
              label="Калорії"
              sub={goalSub(goals.kcal)}
              onTap={focusKcal}
              ariaLabel="Калорії — перейти до поля"
            />
            {/* Кроки редагуються прямо в плитці: окремого поля в дизайні нема. */}
            <StatTile
              icon="activity"
              frac={goalFraction(form.steps, goals.steps)}
              value={
                <input
                  {...stepsInput.inputProps}
                  inputMode="numeric"
                  placeholder="—"
                  aria-label="Кроки"
                  className={cn(
                    "w-full bg-transparent p-0 text-center text-[14.5px] font-semibold outline-none placeholder:text-muted",
                    stepsInput.outOfRange ? "text-neg" : "text-ink",
                  )}
                />
              }
              label="Кроки"
              sub={goalSub(goals.steps)}
            />
            {/* Без onTap: степер усередині — це кнопки, а кнопка в кнопці не живе. */}
            <StatTile
              icon="droplet"
              frac={goalFraction(form.water, goals.water)}
              value={<WaterStepper value={form.water} onChange={(v) => set("water", v)} />}
              label="Вода"
              sub={goalSub(goals.water)}
            />
          </div>

          {/* Харчування */}
          <Card>
            <SectionLabel icon="fork">Харчування</SectionLabel>
            <div className="grid grid-cols-2 gap-[10px]">
              <div ref={kcalWrap}>
                <NumberField
                  label="Калорії"
                  suffix="ккал"
                  value={form.kcal}
                  onChange={(v) => set("kcal", v)}
                />
              </div>
              <NumberField
                label="Білки"
                suffix="г"
                value={form.protein}
                onChange={(v) => set("protein", v)}
              />
              <NumberField label="Жири" suffix="г" value={form.fat} onChange={(v) => set("fat", v)} />
              <NumberField
                label="Вуглеводи"
                suffix="г"
                value={form.carbs}
                onChange={(v) => set("carbs", v)}
              />
            </div>
            <MacroBar protein={form.protein} fat={form.fat} carbs={form.carbs} />
          </Card>

          {/* Спорт + догляд */}
          <Card className="flex flex-col gap-[14px]">
            <div>
              <SectionLabel icon="dumbbell" className="mb-[10px]">
                Спорт
              </SectionLabel>
              <TagInput
                value={form.sport}
                onChange={(v) => set("sport", v)}
                placeholder="зал, пілатес…"
              />
            </div>
            <div className="border-t border-line pt-[14px]">
              <SectionLabel icon="leaf" className="mb-[10px]">
                Догляд за шкірою
              </SectionLabel>
              <PresetChips
                presets={CARE_PRESETS}
                value={form.care}
                onChange={(v) => set("care", v)}
                addLabel="Своє"
              />
            </div>
          </Card>

          {/* Нотатка */}
          <Card>
            <SectionLabel icon="pencil">Нотатка дня</SectionLabel>
            <Textarea
              rows={3}
              placeholder="Як минув день, самопочуття, настрій…"
              value={form.comment}
              onChange={(e) => set("comment", e.target.value)}
            />
          </Card>
        </>
      )}
    </div>
  );
}
