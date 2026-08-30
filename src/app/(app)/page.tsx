"use client";

import { SaveIndicator, useDecimalBuffer, type SaveState } from "@/components/inputs";
import { Icon } from "@/components/icons";
import { DateField, ErrorBanner, PageTitle } from "@/components/ui";
import { DaySkeleton } from "@/components/DaySkeleton";
import { SortableWidget } from "@/components/today/SortableWidget";
import {
  ActivityCard,
  NoteCard,
  NutritionCard,
  StepsCard,
  WaterCard,
  WeightCard,
} from "@/components/today/TodayCards";
import { WeekStrip } from "@/components/today/WeekStrip";
import { dailyGoals } from "@/lib/goals";
import { normalizeOrder, reorder, sameOrder, type WidgetId } from "@/lib/home-widgets";
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
import { useProfile, useRecentSteps, useRecentWeights } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useUid } from "@/components/UserProvider";
import { humanDate, isToday, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const SAVE_DEBOUNCE_MS = 700;
/** Скільки останніх ваг іде в міні-графік. */
const SPARK_POINTS = 14;

/** Назви карток для скрінрідера — і в ручці, і в оголошеннях перетягування. */
const WIDGET_TITLES: Record<WidgetId, string> = {
  weight: "Вага",
  steps: "Кроки",
  water: "Вода",
  nutrition: "Харчування",
  activity: "Спорт і догляд",
  note: "Нотатка дня",
};

const widgetTitle = (id: string | number) => WIDGET_TITLES[id as WidgetId] ?? String(id);

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
  const [editing, setEditing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

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

  // Щоденні цілі й порядок карток живуть у профілі; запит спільний із
  // «Цілями» та прогнозом, тож окремої мережевої роботи екран не додає.
  const profileQ = useProfile();
  const goals = dailyGoals(profileQ.data);

  // Скелетон тримається, поки їде профіль: порядок карток теж лежить у ньому,
  // і без цього екран перетасувався б у юзера на очах через мить після появи.
  const loading = dayQ.isPending || profileQ.isPending;

  // Міні-графік ваги: спільна вибірка з прогнозом і «Цілями», лише хвіст.
  const weightsQ = useRecentWeights();
  const sparkWeights = useMemo(
    () => (weightsQ.data ?? []).slice(-SPARK_POINTS).map((w) => w.weight),
    [weightsQ.data],
  );

  // Те саме для кроків — картка «Кроки» дзеркалить вагу, разом із графіком.
  const stepsQ = useRecentSteps();
  const sparkSteps = useMemo(
    () => (stepsQ.data ?? []).slice(-SPARK_POINTS).map((s) => s.steps),
    [stepsQ.data],
  );

  // ---------------------- Порядок карток ----------------------

  const savedOrder = profileQ.data?.home_widgets;
  const order = useMemo(() => normalizeOrder(savedOrder), [savedOrder]);

  // Профіль — єдине джерело правди про порядок, тож перетягування пише прямо
  // в його кеш і одразу відправляє рядок у БД. Помилка мережі повертає
  // попередній порядок: краще картка стрибне назад, ніж екран показуватиме
  // те, чого в базі нема.
  const persistOrder = useCallback(
    async (next: WidgetId[]) => {
      const key = ["profile", uid];
      const prev = queryClient.getQueryData<Profile | null>(key);
      queryClient.setQueryData<Profile | null>(key, (p) => (p ? { ...p, home_widgets: next } : p));
      setOrderError(null);
      const { error } = await supabase.from("profiles").update({ home_widgets: next }).eq("id", uid);
      if (error) {
        queryClient.setQueryData(key, prev);
        setOrderError("Не вдалося зберегти порядок карток. Перевір зʼєднання.");
      }
    },
    [queryClient, supabase, uid],
  );

  const sensors = useSensors(
    // 4 px відступу: тап по ручці не має рахуватися перетягуванням.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over) return;
      const next = reorder(order, String(active.id), String(over.id));
      if (sameOrder(next, order)) return;
      void persistOrder(next);
    },
    [order, persistOrder],
  );

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Взято картку «${widgetTitle(active.id)}».`,
      onDragOver: ({ active, over }) =>
        over ? `Картка «${widgetTitle(active.id)}» над «${widgetTitle(over.id)}».` : undefined,
      onDragEnd: ({ active, over }) =>
        over
          ? `Картку «${widgetTitle(active.id)}» поставлено на місце «${widgetTitle(over.id)}».`
          : `Картку «${widgetTitle(active.id)}» повернуто на місце.`,
      onDragCancel: ({ active }) => `Переміщення картки «${widgetTitle(active.id)}» скасовано.`,
    }),
    [],
  );

  const widgets: Record<WidgetId, ReactNode> = {
    weight: (
      <WeightCard input={weightInput} weekDelta={weekDelta} spark={sparkWeights} date={date} />
    ),
    steps: <StepsCard input={stepsInput} value={form.steps} goal={goals.steps} spark={sparkSteps} />,
    water: <WaterCard value={form.water} goal={goals.water} onChange={(v) => set("water", v)} />,
    nutrition: <NutritionCard form={form} set={set} />,
    activity: <ActivityCard form={form} set={set} />,
    note: <NoteCard value={form.comment} onChange={(v) => set("comment", v)} />,
  };

  // Порядок нема куди зберігати, поки профіль не приїхав — кнопку не даємо.
  const canEdit = !loading && !!profileQ.data;

  return (
    <div className="flex flex-col gap-[14px]">
      <PageTitle
        subtitle={editing ? "Перетягни картки за ручку" : humanDate(date)}
        right={
          editing ? (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex h-[34px] items-center gap-[6px] rounded-full bg-accent px-[14px] text-[13px] font-semibold text-on-accent transition active:scale-95"
            >
              <Icon name="check" size={13} strokeWidth={2.2} />
              Готово
            </button>
          ) : (
            <>
              <SaveIndicator state={dirty ? "saving" : save} />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Змінити порядок карток"
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition active:scale-95"
                >
                  <Icon name="grid" size={15} strokeWidth={1.7} />
                </button>
              )}
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
          )
        }
      >
        {editing ? "Порядок" : isToday(date) ? "Сьогодні" : "День"}
      </PageTitle>

      {!editing && <WeekStrip date={date} onSelect={setDate} />}

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}
      {orderError && <ErrorBanner>{orderError}</ErrorBanner>}

      {loading ? (
        <DaySkeleton />
      ) : (
        <DndContext
          // Явний id: без нього dnd-kit нумерує службові aria-describedby
          // модульним лічильником, і SSR-розмітка розходиться з клієнтською.
          id="today-widgets"
          sensors={sensors}
          accessibility={{ announcements }}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-[14px]">
              {order.map((id) => (
                <SortableWidget key={id} id={id} title={WIDGET_TITLES[id]} editing={editing}>
                  {widgets[id]}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
