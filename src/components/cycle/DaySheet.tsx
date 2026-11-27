"use client";

import { Icon } from "@/components/icons";
import { SaveIndicator, type SaveState } from "@/components/inputs";
import { Chip, SectionLabel, Sheet, Textarea } from "@/components/ui";
import {
  FLOWS,
  FLOW_LABELS,
  MOODS,
  MOOD_LABELS,
  PHASE_LABELS,
  SYMPTOMS,
  type EntryDraft,
  type Flow,
  type Phase,
} from "@/lib/cycle/types";
import { cn, humanDate } from "@/lib/utils";
import { useState } from "react";

/** Крапля росте разом із силою виділень — розмір несе те саме, що й підпис. */
const DROP_SIZE: Record<Flow, { w: number; h: number; fill: string }> = {
  spotting: { w: 13, h: 17, fill: "#F2CBD3" },
  light: { w: 15, h: 19, fill: "#E28FA0" },
  medium: { w: 17, h: 21, fill: "#D4677E" },
  heavy: { w: 19, h: 23, fill: "#B94A62" },
};

const DROP_PATH = "M7 0C7 0 1 7.2 1 11.3A6 6 0 0 0 13 11.3C13 7.2 7 0 7 0Z";

function FlowSelector({
  value,
  onChange,
}: {
  value: Flow | null;
  onChange: (v: Flow | null) => void;
}) {
  const cell =
    "box-border flex flex-1 flex-col items-center justify-end gap-[5px] rounded-[13px] border px-1 py-[10px] transition active:scale-95";
  const idle = "border-line bg-field";
  // Активний осередок — акцентний тінт без заливки: крапля лишається
  // кольору виділень, і шкала не втрачає свій градієнт на вибраному дні.
  const on = "border-transparent bg-primary-light";

  return (
    <div className="flex gap-[7px]">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(cell, value === null ? on : idle)}
      >
        <span
          className={cn(
            "text-[15px] font-semibold leading-[17px]",
            value === null ? "text-accent" : "text-muted",
          )}
        >
          —
        </span>
        <span
          className={cn(
            "text-[10.5px]",
            value === null ? "font-semibold text-accent" : "font-medium text-muted",
          )}
        >
          немає
        </span>
      </button>

      {FLOWS.map((f) => {
        const active = value === f;
        const { w, h, fill } = DROP_SIZE[f];
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            aria-pressed={active}
            className={cn(cell, active ? on : idle)}
          >
            <svg width={w} height={h} viewBox="0 0 14 18" fill={fill}>
              <path d={DROP_PATH} />
            </svg>
            <span
              className={cn(
                "text-[10.5px]",
                active ? "font-semibold text-accent" : "font-medium text-muted",
              )}
            >
              {FLOW_LABELS[f]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EnergyBars({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          // Повторний тап по поточному рівню знімає його: без цього
          // випадково поставлену енергію не було б як прибрати.
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`Енергія ${n} з 5`}
          aria-pressed={value !== null && n <= value}
          className="flex-1 py-2"
        >
          <span
            className={cn(
              "block h-2 rounded-[4px]",
              value !== null && n <= value ? "bg-accent" : "bg-field",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function DaySheet({
  open,
  date,
  cycleDay,
  phase,
  draft,
  saveState,
  onChange,
  onClose,
}: {
  open: boolean;
  date: string;
  cycleDay: number | null;
  phase: Phase | null;
  draft: EntryDraft;
  saveState: SaveState;
  onChange: (patch: Partial<EntryDraft>) => void;
  onClose: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);

  const toggleSymptom = (key: string) => {
    const has = draft.symptoms.includes(key);
    onChange({
      symptoms: has ? draft.symptoms.filter((s) => s !== key) : [...draft.symptoms, key],
    });
  };

  const meta = [
    cycleDay !== null ? `День циклу ${cycleDay}` : null,
    phase ? PHASE_LABELS[phase] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // «зберігається одразу» — обіцянка; щойно є що зберігати, на її місці
  // стає звіт про те, як воно пройшло. Два повідомлення про одне й те саме
  // поруч тільки змагалися б за увагу.
  const subtitle = (
    <span className="flex flex-wrap items-center gap-x-1.5">
      {meta && <span>{meta}</span>}
      {meta && <span aria-hidden>·</span>}
      {saveState === "idle" ? <span>зберігається одразу</span> : <SaveIndicator state={saveState} />}
    </span>
  );

  return (
    <Sheet open={open} onClose={onClose} title={humanDate(date)} subtitle={subtitle}>
      <div className="flex flex-col gap-5">
        <div>
          <SectionLabel icon="droplet">Виділення</SectionLabel>
          <FlowSelector value={draft.flow} onChange={(flow) => onChange({ flow })} />
        </div>

        <div>
          <SectionLabel icon="activity">Симптоми</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((s) => {
              const active = draft.symptoms.includes(s.key);
              return (
                <Chip key={s.key} active={active} onClick={() => toggleSymptom(s.key)}>
                  {s.label}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel icon="sun">Настрій</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => {
              const active = draft.mood === m;
              return (
                <Chip key={m} active={active} onClick={() => onChange({ mood: active ? null : m })}>
                  {MOOD_LABELS[m]}
                </Chip>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel
            icon="bolt"
            right={
              <span className="text-[12.5px] font-semibold text-accent">
                {draft.energy ? `${draft.energy} / 5` : "—"}
              </span>
            }
          >
            Енергія
          </SectionLabel>
          <EnergyBars value={draft.energy} onChange={(energy) => onChange({ energy })} />
        </div>

        {noteOpen || draft.notes ? (
          <div>
            <SectionLabel icon="file">Нотатка</SectionLabel>
            <Textarea
              rows={3}
              autoFocus={noteOpen && !draft.notes}
              placeholder="Самопочуття, що допомогло, що ні…"
              value={draft.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="flex items-center justify-between rounded-[13px] border border-line bg-field px-[14px] py-3 active:scale-[.99]"
          >
            <span className="text-[14px] font-medium text-muted">Нотатка</span>
            <span className="flex text-accent">
              <Icon name="plus" size={15} strokeWidth={2} />
            </span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
