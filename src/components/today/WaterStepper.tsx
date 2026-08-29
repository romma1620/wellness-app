"use client";

import { Icon } from "@/components/icons";
import { stepWater, WATER_MAX } from "@/lib/goals";
import { cn } from "@/lib/utils";

/**
 * Степер склянок у плитці води: «−  N  +».
 *
 * Раніше плитка була однією кнопкою, що ходила по колу
 * `(water + 1) % (WATER_GOAL + 1)`: щоб прибрати зайву склянку, доводилось
 * доклацати до кінця й обнулити. Тепер мінус є явно, а плюс не впирається в
 * ціль — випите понад неї теж записується (стеля WATER_MAX, як у БД).
 */
export function WaterStepper({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const count = value ?? 0;
  return (
    <>
      <StepButton
        icon="minus"
        label="Прибрати склянку"
        disabled={count <= 0}
        onClick={() => onChange(stepWater(count, -1))}
      />
      <span className="min-w-[20px] tabular-nums">{count}</span>
      <StepButton
        icon="plus"
        label="Додати склянку"
        disabled={count >= WATER_MAX}
        onClick={() => onChange(stepWater(count, 1))}
      />
    </>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border border-line bg-field text-muted transition active:scale-90",
        "disabled:opacity-30 disabled:active:scale-100",
      )}
    >
      <Icon name={icon} size={13} strokeWidth={2} />
    </button>
  );
}
