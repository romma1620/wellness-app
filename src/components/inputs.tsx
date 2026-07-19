"use client";

import { FieldLabel, Input } from "@/components/ui";
import { cn, parseNum } from "@/lib/utils";
import { useEffect, useRef, useState, type ReactNode } from "react";

// ----------------------- NumberField -----------------------
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  min,
  max,
}: {
  label: ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState<string>(value === null ? "" : String(value).replace(".", ","));
  const focused = useRef(false);

  // Синхронізуємо зовнішнє значення, якщо поле не в фокусі.
  useEffect(() => {
    if (!focused.current) {
      setText(value === null ? "" : String(value).replace(".", ","));
    }
  }, [value]);

  const parsed = parseNum(text);
  const outOfRange =
    parsed !== null &&
    ((min !== undefined && parsed < min) || (max !== undefined && parsed > max));

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        inputMode="decimal"
        placeholder={placeholder ?? "—"}
        value={text}
        error={outOfRange}
        suffix={suffix}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          onChange(parseNum(text));
        }}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const p = parseNum(v);
          if (p === null) onChange(null);
          else if ((min === undefined || p >= min) && (max === undefined || p <= max)) onChange(p);
        }}
      />
      {outOfRange && (
        <div className="mt-1 text-[11px] font-bold text-neg">
          Допустимо {min}–{max}
        </div>
      )}
    </div>
  );
}

// ----------------------- WaterDrops -----------------------
export function WaterDrops({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const count = value ?? 0;
  return (
    <div className="flex justify-between">
      {Array.from({ length: 8 }).map((_, i) => {
        const n = i + 1;
        const active = n <= count;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} склянок`}
            onClick={() => onChange(count === n ? n - 1 : n)}
            className={cn(
              "text-[26px] leading-none transition active:scale-90",
              !active && "opacity-25 grayscale",
            )}
          >
            💧
          </button>
        );
      })}
    </div>
  );
}

// ----------------------- PresetChips (toggle preset + custom) -----------------------
export function PresetChips({
  presets,
  value,
  onChange,
  addPlaceholder = "Своє…",
}: {
  presets: string[];
  value: string; // comma-separated
  onChange: (v: string) => void;
  addPlaceholder?: string;
}) {
  const selected = splitTags(value);
  const [draft, setDraft] = useState("");

  const toggle = (tag: string) => {
    const exists = selected.some((s) => s.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== tag.toLowerCase())
      : [...selected, tag];
    onChange(next.join(", "));
  };

  const addCustom = () => {
    const t = draft.trim();
    if (!t) return;
    if (!selected.some((s) => s.toLowerCase() === t.toLowerCase())) {
      onChange([...selected, t].join(", "));
    }
    setDraft("");
  };

  // унікальні пресети + вже вибрані кастомні
  const custom = selected.filter(
    (s) => !presets.some((p) => p.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip key={p} active={selected.some((s) => s.toLowerCase() === p.toLowerCase())} onClick={() => toggle(p)}>
            {p}
          </Chip>
        ))}
        {custom.map((c) => (
          <Chip key={c} active onClick={() => toggle(c)}>
            {c} ✕
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={addPlaceholder}
          className="w-full rounded-full border-[1.5px] border-primary-light bg-bg px-4 py-2 text-[13px] font-semibold text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={addCustom}
          className="shrink-0 rounded-full bg-primary-light px-4 py-2 text-[13px] font-extrabold text-primary"
        >
          Додати
        </button>
      </div>
    </div>
  );
}

// ----------------------- TagInput (free tags) -----------------------
export function TagInput({
  value,
  onChange,
  placeholder = "Додати…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const tags = splitTags(value);
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (t && !tags.some((s) => s.toLowerCase() === t.toLowerCase())) {
      onChange([...tags, t].join(", "));
    }
    setDraft("");
  };
  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag).join(", "));

  return (
    <div className="flex flex-col gap-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Chip key={t} active onClick={() => remove(t)}>
              {t} ✕
            </Chip>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-full border-[1.5px] border-primary-light bg-bg px-4 py-2 text-[13px] font-semibold text-ink outline-none placeholder:text-muted"
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-full bg-primary-light px-4 py-2 text-[13px] font-extrabold text-primary"
        >
          Додати
        </button>
      </div>
    </div>
  );
}

// невеличкий локальний Chip (щоб не тягти onClick-логіку з ui)
function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-[13px] py-[8px] text-[13px] transition active:scale-95",
        active
          ? "bg-primary font-bold text-white"
          : "border-[1.5px] border-primary-light bg-bg font-semibold text-muted",
      )}
    >
      {children}
    </button>
  );
}

// ----------------------- SaveIndicator -----------------------
export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string }> = {
    idle: { text: "", cls: "text-muted" },
    saving: { text: "Збереження…", cls: "text-muted" },
    saved: { text: "✓ Збережено", cls: "text-pos" },
    error: { text: "Помилка збереження", cls: "text-neg" },
  };
  const { text, cls } = map[state];
  if (!text) return <span className="text-[12px] font-bold text-transparent">·</span>;
  return <span className={cn("text-[12px] font-bold", cls)}>{text}</span>;
}

export function splitTags(v: string | null | undefined): string[] {
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
