"use client";

import { Icon } from "@/components/icons";
import {
  NumberField,
  PresetChips,
  TagInput,
  WaterDrops,
  type DecimalBuffer,
} from "@/components/inputs";
import { CycleRow } from "@/components/today/CycleRow";
import { GoalBadge } from "@/components/today/GoalBadge";
import { MacroBar } from "@/components/today/MacroBar";
import { Sparkline } from "@/components/today/Sparkline";
import { Card, SectionLabel, Textarea } from "@/components/ui";
import { CARE_PRESETS } from "@/lib/care";
import type { DailyForm } from "@/lib/daily-log";
import { waterRow } from "@/lib/goals";
import { cn, fmt } from "@/lib/utils";

/**
 * Картки екрана «Сьогодні» — по одній на віджет із `WidgetId`.
 *
 * Живуть окремо від сторінки, бо сторінка тепер відповідає ще й за порядок
 * та режим редагування; тримати там же 200 рядків розмітки означало б файл,
 * у якому логіка збереження губиться між інпутами. Стан лишається на
 * сторінці — сюди приходять лише значення й сеттер.
 */

/** Сеттер одного поля форми дня; типізований так само, як на сторінці. */
export type FieldSetter = <K extends keyof DailyForm>(key: K, value: DailyForm[K]) => void;

export function WeightCard({
  input,
  weekDelta,
  spark,
  date,
}: {
  input: DecimalBuffer;
  /** Різниця з вагою тиждень тому; null — порівнювати нема з чим. */
  weekDelta: number | null;
  spark: number[];
  date: string;
}) {
  return (
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
              {...input.inputProps}
              placeholder="—"
              aria-label="Вага, кг"
              className="w-full min-w-0 bg-transparent p-0 text-[44px] font-normal leading-none tracking-[-.01em] text-ink outline-none placeholder:text-muted"
            />
            <span className="shrink-0 text-[14px] font-medium text-muted">кг</span>
          </div>
          {input.outOfRange && (
            <div className="mt-1 text-[11px] font-semibold text-neg">Допустимо 30–200</div>
          )}
        </div>
        <Sparkline values={spark} />
      </div>
      <CycleRow date={date} />
    </Card>
  );
}

/**
 * Кроки — та сама картка, що й вага: велике число редагується прямо тут,
 * праворуч у шапці замість тижневої дельти стоїть ціль.
 */
export function StepsCard({
  input,
  value,
  goal,
  spark,
}: {
  input: DecimalBuffer;
  value: number | null;
  goal: number | null;
  spark: number[];
}) {
  return (
    <Card>
      <SectionLabel icon="activity" className="mb-0" right={<GoalBadge value={value} goal={goal} />}>
        Кроки
      </SectionLabel>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <input
              {...input.inputProps}
              inputMode="numeric"
              placeholder="—"
              aria-label="Кроки"
              className={cn(
                "w-full min-w-0 bg-transparent p-0 text-[44px] font-normal leading-none tracking-[-.01em] outline-none placeholder:text-muted",
                input.outOfRange ? "text-neg" : "text-ink",
              )}
            />
            <span className="shrink-0 text-[14px] font-medium text-muted">кроків</span>
          </div>
          {input.outOfRange && (
            <div className="mt-1 text-[11px] font-semibold text-neg">Допустимо 0–100 000</div>
          )}
        </div>
        <Sparkline values={spark} />
      </div>
    </Card>
  );
}

/** Вода: тап по n-й краплі ставить n, тап по останній налитій знімає її. */
export function WaterCard({
  value,
  goal,
  onChange,
}: {
  value: number | null;
  goal: number | null;
  onChange: (v: number | null) => void;
}) {
  // Ряд крапель і лічильник над ним рахуються з однієї розкладки, щоб
  // «6 / 8» і кількість налитих крапель не могли розійтися.
  const water = waterRow(value, goal);
  return (
    <Card>
      <SectionLabel
        icon="droplet"
        className="mb-[14px]"
        right={
          <span
            className={cn(
              "flex items-center gap-[5px] text-[13px] font-bold",
              water.filled >= water.slots ? "text-pos" : "text-accent",
            )}
          >
            {water.filled >= water.slots && <Icon name="check" size={12} strokeWidth={2.4} />}
            {water.filled + water.over} / {water.slots} склянок
          </span>
        }
      >
        Вода
      </SectionLabel>
      <WaterDrops value={value} goal={goal} onChange={onChange} />
    </Card>
  );
}

export function NutritionCard({ form, set }: { form: DailyForm; set: FieldSetter }) {
  return (
    <Card>
      <SectionLabel icon="fork">Харчування</SectionLabel>
      <div className="grid grid-cols-2 gap-[10px]">
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
      <MacroBar protein={form.protein} fat={form.fat} carbs={form.carbs} />
    </Card>
  );
}

/** Спорт і догляд — одна картка на дві секції, розділені лінією. */
export function ActivityCard({ form, set }: { form: DailyForm; set: FieldSetter }) {
  return (
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
  );
}

export function NoteCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Card>
      <SectionLabel icon="pencil">Нотатка дня</SectionLabel>
      <Textarea
        rows={3}
        placeholder="Як минув день, самопочуття, настрій…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Card>
  );
}
