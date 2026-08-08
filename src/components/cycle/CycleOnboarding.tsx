"use client";

import { CycleLengthSlider } from "@/components/cycle/CycleLengthSlider";
import { Button, DateField, ErrorBanner } from "@/components/ui";
import { DEFAULT_SETTINGS } from "@/lib/cycle/types";
import { humanDate, todayISO } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Перший запуск (C5). Три речі в одному екрані, а не візард: опт-ін,
 * дата останньої менструації і типова довжина циклу. Прогноз малюється
 * одразу після «Увімкнути» — саме тому дата тут обовʼязкова.
 */
export function CycleOnboarding({
  onEnable,
}: {
  onEnable: (v: { lastPeriodStart: string; typicalCycleLength: number }) => Promise<void>;
}) {
  const router = useRouter();
  const [lastPeriod, setLastPeriod] = useState(todayISO());
  const [length, setLength] = useState(DEFAULT_SETTINGS.typical_cycle_length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      await onEnable({ lastPeriodStart: lastPeriod, typicalCycleLength: length });
    } catch {
      setError("Не вдалося увімкнути трекінг. Перевір зʼєднання.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[15px]">
      <h1 className="px-1 pt-1 text-[22px] font-extrabold">Цикл</h1>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div
        className="flex flex-col items-center rounded-xl2 px-5 pb-6 pt-[22px] text-center"
        style={{ background: "linear-gradient(135deg, #FBE2E8 0%, var(--primary-light) 100%)" }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/75">
          <svg
            width="30"
            height="30"
            viewBox="0 0 22 22"
            fill="none"
            stroke="#C05B71"
            strokeWidth={1.9}
            strokeLinecap="round"
          >
            <path d="M18 11a7 7 0 1 1-2.6-5.4" />
            <path d="M18.4 3.4v3.4H15" />
          </svg>
        </div>
        <div className="mt-3.5 text-[19px] font-extrabold">Додай трекінг циклу</div>
        <div className="mt-[7px] text-[13.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
          Дні менструації, симптоми й настрій. Далі aura сама покаже фазу та прогноз — і
          зіставить їх із вагою та тренуваннями.
        </div>
      </div>

      <div className="flex items-start gap-[13px] rounded-xl2 bg-surface p-4 shadow-card">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bg">
          <svg
            width="18"
            height="18"
            viewBox="0 0 22 22"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4.5" y="9.5" width="13" height="9" rx="2.5" />
            <path d="M7.5 9.5V7a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
        </div>
        <div>
          <div className="text-[14px] font-extrabold">Ці дані бачиш тільки ти</div>
          <div className="mt-1 text-[12.5px] font-semibold leading-[1.5] text-muted [text-wrap:pretty]">
            Вони не потрапляють в аналітику застосунку. Вимкнути фічу або видалити все —
            одним тапом у профілі.
          </div>
        </div>
      </div>

      <div className="rounded-xl2 bg-surface p-4 pt-[18px] shadow-card">
        <div className="mb-2.5 text-[12.5px] font-bold text-muted">
          Коли почалась остання менструація?
        </div>
        <DateField
          value={lastPeriod}
          onChange={setLastPeriod}
          max={todayISO()}
          label="Дата початку останньої менструації"
          className="flex items-center justify-between rounded-[15px] border-[1.5px] border-primary-light bg-bg px-4 py-[15px]"
        >
          <span className="text-[15px] font-extrabold">{humanDate(lastPeriod)}</span>
          <svg
            width="19"
            height="19"
            viewBox="0 0 22 22"
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.9}
            strokeLinecap="round"
          >
            <rect x="3" y="4.5" width="16" height="15" rx="3.5" />
            <path d="M3 9h16M7 2.5v3M15 2.5v3" />
          </svg>
        </DateField>
        <div className="mt-2.5 text-[11.5px] font-semibold text-muted">
          Не памʼятаєш точно — постав приблизно, потім поправиш у календарі.
        </div>
      </div>

      <div className="rounded-xl2 bg-surface p-4 pt-[18px] shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-muted">Типова довжина циклу</span>
          <span className="text-[16px] font-extrabold">{length} днів</span>
        </div>
        <CycleLengthSlider value={length} onChange={setLength} />
        <button
          type="button"
          onClick={() => setLength(DEFAULT_SETTINGS.typical_cycle_length)}
          className="mt-2 w-full text-center text-[12.5px] font-bold text-primary"
        >
          Не знаю точно
        </button>
      </div>

      <Button type="button" onClick={enable} loading={busy}>
        Увімкнути трекінг циклу
      </Button>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="pb-2 text-center text-[13px] font-bold text-muted"
      >
        Не зараз
      </button>
    </div>
  );
}
