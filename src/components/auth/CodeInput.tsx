"use client";

import { OTP_LENGTH } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

/**
 * Поле 6-значного коду з листа. Візуально — шість клітинок, за ними один
 * невидимий input на всю площу: так працюють системна клавіатура, вставка
 * з буфера й автопідстановка коду з SMS/пошти (autocomplete="one-time-code"),
 * а нам не треба жонглювати фокусом між шістьма полями.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Викликається, щойно введено всі цифри. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, OTP_LENGTH);
    onChange(digits);
    if (digits.length === OTP_LENGTH && digits !== value) onComplete?.(digits);
  }

  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Код підтвердження з листа"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none flex justify-center gap-[9px]">
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const digit = value[i];
          const active = focused && i === activeIndex && value.length < OTP_LENGTH;
          return (
            <div
              key={i}
              className={cn(
                "flex h-[54px] w-[44px] items-center justify-center rounded-[15px] border-[1.5px] bg-surface text-[22px] font-extrabold text-ink transition",
                error ? "border-neg" : active ? "border-primary" : "border-primary-light",
                disabled && "opacity-50",
              )}
            >
              {digit ?? (active ? <span className="aura-pulse text-primary">·</span> : "")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
