"use client";

import { CYCLE_LENGTH_MAX, CYCLE_LENGTH_MIN } from "@/lib/cycle/types";

/**
 * Слайдер типової довжини циклу.
 *
 * Вигляд намальований дивами під дизайн, але тягне його справжній
 * `input[type=range]`, прозорий і розтягнутий поверх: так лишаються
 * клавіатура, скрінрідер і нативний драг, яких кастомний драг на
 * pointer-подіях не дав би.
 */
export function CycleLengthSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - CYCLE_LENGTH_MIN) / (CYCLE_LENGTH_MAX - CYCLE_LENGTH_MIN)) * 100;

  return (
    <div>
      <div className="relative h-2 rounded-[4px] bg-primary-light">
        <div
          className="absolute inset-y-0 left-0 rounded-[4px] bg-primary"
          style={{ width: `${pct}%` }}
        />
        <div
          aria-hidden
          className="absolute top-1/2 h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary bg-surface shadow-soft"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={CYCLE_LENGTH_MIN}
          max={CYCLE_LENGTH_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Типова довжина циклу, днів"
          className="absolute -inset-y-3 inset-x-0 w-full cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>
      <div className="mt-3 flex justify-between text-[11px] font-bold text-muted">
        <span>{CYCLE_LENGTH_MIN}</span>
        <span>{CYCLE_LENGTH_MAX}</span>
      </div>
    </div>
  );
}
