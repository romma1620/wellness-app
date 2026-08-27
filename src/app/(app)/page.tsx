"use client";

import {
  NumberField,
  PresetChips,
  SaveIndicator,
  TagInput,
  useDecimalBuffer,
  WaterDrops,
  type SaveState,
} from "@/components/inputs";
import { Card, DateField, ErrorBanner, SectionLabel, Textarea } from "@/components/ui";
import { DaySkeleton } from "@/components/DaySkeleton";
import { CARE_PRESETS } from "@/lib/care";
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
import { createClient } from "@/lib/supabase/client";
import { useUid } from "@/components/UserProvider";
import { addDays, cn, fmt, humanDate, isToday, todayISO } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SAVE_DEBOUNCE_MS = 700;

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

  return (
    <div className="flex flex-col gap-[15px]">
      {/* Хедер з датою */}
      <div className="flex items-center justify-between px-1 pt-1">
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, -1))}
          aria-label="Попередній день"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[13px] bg-surface text-[20px] font-bold text-muted shadow-soft active:scale-95"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-[18px] font-extrabold">
            {isToday(date) ? "Сьогодні" : "День"}
          </div>
          <DateField
            value={date}
            onChange={setDate}
            max={todayISO()}
            label="Дата дня у щоденнику"
            className="flex items-center justify-center gap-1 text-[12.5px] font-semibold text-muted"
          >
            {humanDate(date)}
            <span aria-hidden>📅</span>
          </DateField>
        </div>
        <button
          type="button"
          onClick={() => !isToday(date) && setDate((d) => addDays(d, 1))}
          aria-label="Наступний день"
          disabled={isToday(date)}
          className={cn(
            "flex h-[38px] w-[38px] items-center justify-center rounded-[13px] text-[20px] font-bold active:scale-95",
            isToday(date)
              ? "bg-surface text-muted opacity-40"
              : "bg-primary-light text-primary",
          )}
        >
          ›
        </button>
      </div>

      <div className="flex justify-end px-1">
        <SaveIndicator state={dirty ? "saving" : save} />
      </div>

      {loadError && <ErrorBanner>{loadError}</ErrorBanner>}

      {loading ? (
        <DaySkeleton />
      ) : (
        <>
          {/* Вага */}
          <Card className="flex items-end justify-between">
            <div className="w-full">
              <div className="text-[12.5px] font-bold text-muted">Вага</div>
              <div className="mt-1">
                <input
                  {...weightInput.inputProps}
                  placeholder="—"
                  className="w-full bg-transparent text-[40px] font-extrabold leading-none text-ink outline-none placeholder:text-primary-light"
                />
              </div>
              <div
                className={cn(
                  "mt-1 text-[12px] font-bold",
                  weightInput.outOfRange ? "text-neg" : "text-muted",
                )}
              >
                кг · допустимо 30–200
              </div>
            </div>
            {weekDelta != null && Math.abs(weekDelta) >= 0.05 && (
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "text-[13px] font-extrabold",
                    weekDelta < 0 ? "text-pos" : "text-warn",
                  )}
                >
                  {weekDelta < 0 ? "↓" : "↑"} {fmt(Math.abs(weekDelta), 1)} кг
                </div>
                <div className="text-[11px] font-semibold text-muted">за тиждень</div>
              </div>
            )}
          </Card>

          {/* Харчування */}
          <Card>
            <SectionLabel>Харчування</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Калорії"
                suffix="ккал"
                value={form.kcal}
                onChange={(v) => set("kcal", v)}
              />
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
          </Card>

          {/* Вода */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel className="mb-0">Вода</SectionLabel>
              <div className="text-[13px] font-extrabold text-primary">
                {form.water ?? 0} / 8 склянок
              </div>
            </div>
            <WaterDrops value={form.water} onChange={(v) => set("water", v)} />
          </Card>

          {/* Кроки + спорт */}
          <div className="flex flex-col gap-3">
            <Card>
              <NumberField
                label="Кроки"
                suffix="кроків"
                placeholder="0"
                min={0}
                max={100000}
                value={form.steps}
                onChange={(v) => set("steps", v == null ? null : Math.round(v))}
              />
            </Card>
            <Card>
              <SectionLabel>Спорт</SectionLabel>
              <TagInput
                value={form.sport}
                onChange={(v) => set("sport", v)}
                placeholder="зал, пілатес…"
              />
            </Card>
          </div>

          {/* Догляд */}
          <Card>
            <SectionLabel>Догляд за шкірою</SectionLabel>
            <PresetChips presets={CARE_PRESETS} value={form.care} onChange={(v) => set("care", v)} />
          </Card>

          {/* Коментар */}
          <Card>
            <SectionLabel>Коментар дня</SectionLabel>
            <Textarea
              rows={3}
              placeholder="Як минув день, самопочуття, настрій…"
              value={form.comment}
              onChange={(e) => set("comment", e.target.value)}
            />
          </Card>
        </>
      )}

      <p className="px-2 pt-1 text-center text-[12px] font-semibold text-muted">
        Зміни зберігаються автоматично
      </p>
    </div>
  );
}
