"use client";

import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const R = 23;
const C = 2 * Math.PI * R;

/** Кільце прогресу 52px: доріжка лінією, дуга акцентом, іконка всередині. */
export function Ring({ frac, icon }: { frac: number; icon: IconName }) {
  const dash = (C * Math.min(Math.max(frac, 0), 1)).toFixed(1);
  return (
    <span className="relative flex h-[52px] w-[52px] items-center justify-center">
      <svg width={52} height={52} viewBox="0 0 52 52" className="absolute inset-0" aria-hidden>
        <circle cx={26} cy={26} r={R} fill="none" stroke="var(--line)" strokeWidth={4} />
        <circle
          cx={26}
          cy={26}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C.toFixed(1)}`}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="relative flex text-accent">
        <Icon name={icon} size={17} strokeWidth={1.7} />
      </span>
    </span>
  );
}

const TILE_CLS =
  "flex w-full flex-col items-center gap-[7px] rounded-[18px] bg-surface px-2 pb-3 pt-[14px] text-center transition active:scale-[.98]";

/**
 * Плитка показника: кільце, значення, капітельний підпис і підказка.
 * З `onTap` — кнопка; без нього — блок (значення тоді може бути інпутом
 * або степером, які всередині button жити не можуть).
 *
 * Рядок значення має фіксовану висоту: у плитці води там стоять кнопки
 * «−» і «+», і без неї сусідні плитки в сітці розʼїжджалися б по вертикалі.
 */
export function StatTile({
  icon,
  frac,
  value,
  label,
  sub,
  onTap,
  ariaLabel,
}: {
  icon: IconName;
  frac: number;
  value: ReactNode;
  label: string;
  sub: string;
  onTap?: () => void;
  ariaLabel?: string;
}) {
  const body = (
    <>
      <Ring frac={frac} icon={icon} />
      <span className="flex h-[28px] w-full items-center justify-center gap-1 text-[14.5px] font-semibold text-ink">
        {value}
      </span>
      <span className="flex flex-col items-center gap-[2px]">
        <span className="text-[9.5px] font-semibold uppercase tracking-[.08em] text-muted">
          {label}
        </span>
        <span className="text-[10px] font-normal text-muted">{sub}</span>
      </span>
    </>
  );
  if (onTap) {
    return (
      <button type="button" onClick={onTap} aria-label={ariaLabel} className={TILE_CLS}>
        {body}
      </button>
    );
  }
  return <div className={cn(TILE_CLS, "active:scale-100")}>{body}</div>;
}
