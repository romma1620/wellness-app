"use client";

import { CycleLengthSlider } from "@/components/cycle/CycleLengthSlider";
import { phaseTint } from "@/components/cycle/tint";
import { Icon } from "@/components/icons";
import { Button, Card, DateField, ErrorBanner, PageTitle, SectionLabel } from "@/components/ui";
import { DEFAULT_SETTINGS, PHASE_COLORS } from "@/lib/cycle/types";
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
    <div className="flex flex-col gap-[14px]">
      <PageTitle>Цикл</PageTitle>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div
        className="flex flex-col items-center rounded-xl2 px-5 pb-6 pt-[22px] text-center"
        style={{
          background: `linear-gradient(140deg, ${phaseTint("menstrual")} 0%, var(--surface) 65%)`,
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[18px]"
          style={{ background: phaseTint("menstrual"), color: PHASE_COLORS.menstrual }}
        >
          <Icon name="cycle" size={26} strokeWidth={1.6} />
        </div>
        <div className="mt-3.5 text-[19px] font-bold text-ink">Додай трекінг циклу</div>
        <div className="mt-[7px] text-[12.5px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
          Дні менструації, симптоми й настрій. Далі aura сама покаже фазу та прогноз — і
          зіставить їх із вагою та тренуваннями.
        </div>
      </div>

      <Card className="flex items-start gap-[13px]">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-primary-light text-accent">
          <Icon name="lock" size={17} strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-[13.5px] font-bold text-ink">Ці дані бачиш тільки ти</div>
          <div className="mt-1 text-[12.5px] font-normal leading-[1.55] text-muted [text-wrap:pretty]">
            Вони не потрапляють в аналітику застосунку. Вимкнути фічу або видалити все —
            одним тапом у профілі.
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel icon="calendar">Остання менструація</SectionLabel>
        <DateField
          value={lastPeriod}
          onChange={setLastPeriod}
          max={todayISO()}
          label="Дата початку останньої менструації"
          className="flex items-center justify-between rounded-[13px] border border-line bg-field px-[14px] py-3"
        >
          <span className="text-[15px] font-medium text-ink">{humanDate(lastPeriod)}</span>
          <span className="flex text-muted">
            <Icon name="calendar" size={16} strokeWidth={1.6} />
          </span>
        </DateField>
        <div className="mt-2.5 text-[11.5px] font-normal text-muted">
          Не памʼятаєш точно — постав приблизно, потім поправиш у календарі.
        </div>
      </Card>

      <Card>
        <SectionLabel
          icon="ruler"
          right={<span className="text-[14px] font-semibold text-ink">{length} днів</span>}
        >
          Типова довжина циклу
        </SectionLabel>
        <CycleLengthSlider value={length} onChange={setLength} />
        <button
          type="button"
          onClick={() => setLength(DEFAULT_SETTINGS.typical_cycle_length)}
          className="mt-2 w-full text-center text-[12.5px] font-semibold text-accent"
        >
          Не знаю точно
        </button>
      </Card>

      <Button type="button" onClick={enable} loading={busy}>
        Увімкнути трекінг циклу
      </Button>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="pb-2 text-center text-[13px] font-medium text-muted"
      >
        Не зараз
      </button>
    </div>
  );
}
