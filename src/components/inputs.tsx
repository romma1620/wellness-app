"use client";

import { Icon } from "@/components/icons";
import { Chip, FieldLabel, Input } from "@/components/ui";
import { waterRow } from "@/lib/goals";
import { cn, parseNum, splitTags } from "@/lib/utils";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

// ----------------------- useDecimalBuffer -----------------------
// Буфер тексту для десяткових інпутів: зберігає рядок як його ввели
// (зокрема з комою), синхронізується із зовнішнім значенням лише поза фокусом.
function numToText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

export function useDecimalBuffer(
  value: number | null,
  onChange: (v: number | null) => void,
  opts?: { min?: number; max?: number },
) {
  const [text, setText] = useState<string>(() => numToText(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(numToText(value));
  }, [value]);

  const parsed = parseNum(text);
  const outOfRange =
    parsed !== null &&
    ((opts?.min !== undefined && parsed < opts.min) ||
      (opts?.max !== undefined && parsed > opts.max));

  const inputProps = {
    inputMode: "decimal" as const,
    value: text,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      onChange(parseNum(text));
    },
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      // Дозволяємо лише цифри, кому, крапку та пробіли.
      if (!/^[0-9.,\s]*$/.test(v)) return;
      setText(v);
      const p = parseNum(v);
      if (p === null) onChange(null);
      else if (
        (opts?.min === undefined || p >= opts.min) &&
        (opts?.max === undefined || p <= opts.max)
      )
        onChange(p);
    },
  };

  return { text, parsed, outOfRange, inputProps };
}

// ----------------------- NumberField -----------------------
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  min,
  max,
  inputMode,
}: {
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
  /** Для цілих полів («numeric») — інакше клавіатура пропонує кому. */
  inputMode?: "decimal" | "numeric";
}) {
  const { outOfRange, inputProps } = useDecimalBuffer(value, onChange, { min, max });

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        placeholder={placeholder ?? "—"}
        error={outOfRange}
        suffix={suffix}
        {...inputProps}
        inputMode={inputMode ?? inputProps.inputMode}
      />
      {outOfRange && (
        <div className="mt-1 text-[11px] font-semibold text-neg">
          Допустимо {min}–{max}
        </div>
      )}
    </div>
  );
}

// ----------------------- WaterDrops -----------------------
/**
 * Склянки дня як ряд крапель: налита — залита акцентом, порожня — контур.
 * Тап по n-й ставить n, тап по останній налитій знімає її.
 *
 * Обводки навколо краплі нема — мішень це сама іконка, тож 30px зони тапу
 * тримає обгортка. Краплі діляться шириною картки: на цілі 8 виходить рівно
 * 30px, на більшій — стискаються, а не переносяться на другий рядок.
 */
export function WaterDrops({
  value,
  goal,
  onChange,
}: {
  value: number | null;
  goal: number | null;
  onChange: (v: number) => void;
}) {
  const { slots, filled, over } = waterRow(value, goal);
  return (
    <div className="flex items-center justify-between gap-[6px]">
      {Array.from({ length: slots }).map((_, i) => {
        const n = i + 1;
        const active = n <= filled;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} склянок`}
            aria-pressed={active}
            onClick={() => onChange(filled === n && over === 0 ? n - 1 : n)}
            className={cn(
              "flex aspect-square max-w-[30px] flex-1 items-center justify-center transition active:scale-90",
              active ? "text-accent" : "text-muted opacity-45",
            )}
          >
            <Icon
              name="droplet"
              strokeWidth={1.7}
              fill={active ? "currentColor" : "none"}
              className="h-[84%] w-[84%]"
            />
          </button>
        );
      })}
      {over > 0 && <span className="shrink-0 pl-1 text-[12px] font-bold text-accent">+{over}</span>}
    </div>
  );
}

// ----------------------- Inline «Додати» -----------------------
/**
 * Чип «+ Додати», що розгортається в поле вводу. Поле живе лише доки його
 * відкрили: Enter або «Додати» підтверджує, Esc чи порожній blur — згортає.
 */
function AddChip({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const confirm = () => {
    const t = draft.trim();
    if (t) onAdd(t);
    setDraft("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Chip dashed icon="plus" onClick={() => setOpen(true)}>
        {label}
      </Chip>
    );
  }

  return (
    <span className="flex items-center gap-[6px] rounded-full border border-line bg-field pl-[14px] pr-1">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirm();
          } else if (e.key === "Escape") {
            setDraft("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!draft.trim()) setOpen(false);
        }}
        placeholder={placeholder}
        className="w-[110px] bg-transparent py-2 text-[12.5px] font-medium text-ink outline-none placeholder:text-muted"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={confirm}
        aria-label="Додати"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent text-on-accent active:scale-90"
      >
        <Icon name="check" size={12} strokeWidth={2.2} />
      </button>
    </span>
  );
}

// ----------------------- PresetChips (toggle preset + custom) -----------------------
export function PresetChips({
  presets,
  value,
  onChange,
  addLabel = "Своє",
  addPlaceholder = "Своє…",
}: {
  presets: readonly string[];
  value: string; // comma-separated
  onChange: (v: string) => void;
  addLabel?: string;
  addPlaceholder?: string;
}) {
  const selected = splitTags(value);

  const toggle = (tag: string) => {
    const exists = selected.some((s) => s.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== tag.toLowerCase())
      : [...selected, tag];
    onChange(next.join(", "));
  };

  const addCustom = (t: string) => {
    if (!selected.some((s) => s.toLowerCase() === t.toLowerCase())) {
      onChange([...selected, t].join(", "));
    }
  };

  // унікальні пресети + вже вибрані кастомні
  const custom = selected.filter((s) => !presets.some((p) => p.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <Chip
          key={p}
          active={selected.some((s) => s.toLowerCase() === p.toLowerCase())}
          onClick={() => toggle(p)}
        >
          {p}
        </Chip>
      ))}
      {custom.map((c) => (
        <Chip key={c} active onClick={() => toggle(c)}>
          {c}
          <Icon name="x" size={11} strokeWidth={2} />
        </Chip>
      ))}
      <AddChip label={addLabel} placeholder={addPlaceholder} onAdd={addCustom} />
    </div>
  );
}

// ----------------------- TagInput (free tags) -----------------------
export function TagInput({
  value,
  onChange,
  placeholder = "Додати…",
  addLabel = "Додати",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const tags = splitTags(value);

  const add = (t: string) => {
    if (!tags.some((s) => s.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t].join(", "));
    }
  };
  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag).join(", "));

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <Chip key={t} active onClick={() => remove(t)}>
          {t}
          <Icon name="x" size={11} strokeWidth={2} />
        </Chip>
      ))}
      <AddChip label={addLabel} placeholder={placeholder} onAdd={add} />
    </div>
  );
}

// ----------------------- SaveIndicator -----------------------
export type SaveState = "idle" | "saving" | "saved" | "error";

/** Статус автозбереження як пілюля; в idle тримає місце, щоб шапка не стрибала. */
export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return <span className="h-[26px]" aria-hidden />;
  const map: Record<Exclude<SaveState, "idle">, { text: string; cls: string; icon?: "check" }> = {
    saving: { text: "Збереження…", cls: "bg-field text-muted" },
    saved: {
      text: "Збережено",
      cls: "bg-[color:color-mix(in_oklab,var(--pos)_13%,transparent)] text-pos",
      icon: "check",
    },
    error: {
      text: "Не збережено",
      cls: "bg-[color:color-mix(in_oklab,var(--neg)_13%,transparent)] text-neg",
    },
  };
  const { text, cls, icon } = map[state];
  return (
    <span
      role="status"
      className={cn(
        "flex h-[26px] items-center gap-[5px] rounded-full px-[10px] text-[10.5px] font-semibold",
        cls,
      )}
    >
      {icon && <Icon name={icon} size={11} strokeWidth={2.2} />}
      {text}
    </span>
  );
}
