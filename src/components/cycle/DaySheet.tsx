"use client";

import { SaveIndicator, type SaveState } from "@/components/inputs";
import { Sheet, Textarea } from "@/components/ui";
import {
  FLOWS,
  FLOW_LABELS,
  MOODS,
  MOOD_EMOJI,
  MOOD_LABELS,
  PHASE_LABELS,
  SYMPTOMS,
  type EntryDraft,
  type Flow,
  type Mood,
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

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12.5px] font-bold text-muted">{children}</div>;
}

function FlowSelector({
  value,
  onChange,
}: {
  value: Flow | null;
  onChange: (v: Flow | null) => void;
}) {
  const cell =
    "flex flex-1 flex-col items-center justify-end gap-[5px] rounded-[14px] px-1 py-[11px] transition active:scale-95";

  return (
    <div className="flex gap-[7px]">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(
          cell,
          value === null
            ? "bg-primary shadow-cta"
            : "border-[1.5px] border-primary-light bg-bg",
        )}
      >
        <span
          className={cn(
            "text-[15px] font-extrabold leading-[17px]",
            value === null ? "text-white" : "text-muted",
          )}
        >
          —
        </span>
        <span
          className={cn(
            "text-[10.5px]",
            value === null ? "font-extrabold text-white" : "font-bold text-muted",
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
            className={cn(
              cell,
              active ? "bg-primary shadow-cta" : "border-[1.5px] border-primary-light bg-bg",
            )}
          >
            <svg width={w} height={h} viewBox="0 0 14 18" fill={active ? "#fff" : fill}>
              <path d={DROP_PATH} />
            </svg>
            <span
              className={cn(
                "text-[10.5px]",
                active ? "font-extrabold text-white" : "font-bold text-muted",
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
          className="flex-1 py-2"
        >
          <span
            className={cn(
              "block h-2.5 rounded-[5px]",
              value !== null && n <= value ? "bg-primary" : "bg-primary-light",
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
        <div className="flex flex-col gap-2.5">
          <Label>Виділення</Label>
          <FlowSelector value={draft.flow} onChange={(flow) => onChange({ flow })} />
        </div>

        <div className="flex flex-col gap-2.5">
          <Label>Симптоми</Label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOMS.map((s) => {
              const active = draft.symptoms.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSymptom(s.key)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full px-[14px] py-[9px] text-[13px] transition active:scale-95",
                    active
                      ? "bg-primary font-extrabold text-white"
                      : "border-[1.5px] border-primary-light bg-bg font-semibold text-muted",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Label>Настрій</Label>
          <div className="flex justify-between">
            {MOODS.map((m) => {
              const active = draft.mood === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ mood: active ? null : m })}
                  aria-label={`Настрій ${MOOD_LABELS[m]}`}
                  aria-pressed={active}
                  className={cn(
                    "flex h-[34px] w-[34px] items-center justify-center rounded-full text-[17px] transition active:scale-90",
                    active ? "bg-primary-light" : "bg-bg opacity-50",
                  )}
                  style={active ? { boxShadow: "0 0 0 2px var(--primary)" } : undefined}
                >
                  {MOOD_EMOJI[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <Label>Енергія</Label>
            <span className="text-[12.5px] font-extrabold text-primary">
              {draft.energy ? `${draft.energy} / 5` : "—"}
            </span>
          </div>
          <EnergyBars value={draft.energy} onChange={(energy) => onChange({ energy })} />
        </div>

        {noteOpen || draft.notes ? (
          <div className="flex flex-col gap-2.5">
            <Label>Нотатка</Label>
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
            className="flex items-center justify-between rounded-[15px] border-[1.5px] border-primary-light bg-bg px-[15px] py-3.5 active:scale-[.99]"
          >
            <span className="text-[14px] font-bold text-muted">Нотатка</span>
            <span className="text-[18px] font-extrabold leading-none text-primary">+</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}
