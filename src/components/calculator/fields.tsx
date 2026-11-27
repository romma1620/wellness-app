import { cn, fmt, fmtInt } from "@/lib/utils";
import type { ChangeEvent, ReactNode } from "react";

/** Скільки порожніх порцій на старті — найчастіше готують на двох. */
export const START_PORTIONS = 2;

/** Пропси для поля ваги: лише цифри, кома, крапка — як у `useDecimalBuffer`. */
export function grams(value: string, set: (v: string) => void) {
  return {
    inputMode: "decimal" as const,
    value,
    suffix: "г",
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      if (/^[0-9.,\s]*$/.test(e.target.value)) set(e.target.value);
    },
  };
}

/** Вага для кухонних ваг: до 10 г — з десятою (спеції, олія), далі — цілими. */
export function fmtGrams(g: number): string {
  return `${g < 10 ? fmt(g, 1) : fmtInt(g)} г`;
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-medium text-muted">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Номер рядка зліва від поля. */
export function RowNum({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn("w-[18px] shrink-0 text-center text-[12px] font-semibold text-muted", className)}
    >
      {children}
    </span>
  );
}
