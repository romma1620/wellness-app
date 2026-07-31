"use client";

import { cn } from "@/lib/utils";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

// ----------------------- Card -----------------------
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "form";
}) {
  return (
    <Tag className={cn("rounded-xl2 bg-surface p-4 shadow-card", className)}>{children}</Tag>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 text-[12.5px] font-bold text-muted", className)}>{children}</div>
  );
}

// ----------------------- Button -----------------------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", loading, className, children, disabled, ...rest },
  ref,
) {
  const base =
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-[15px] text-[16px] font-extrabold transition active:scale-[.98] disabled:opacity-60 disabled:active:scale-100";
  const styles = {
    primary: "bg-primary text-white shadow-cta",
    outline: "border-[1.5px] border-primary-light bg-surface text-ink",
    ghost: "bg-primary-light text-primary",
  }[variant];
  return (
    <button
      ref={ref}
      className={cn(base, styles, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

// ----------------------- Field / Input -----------------------
export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-[7px] text-[12.5px] font-bold text-muted">{children}</div>;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  suffix?: ReactNode;
  error?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, suffix, error, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[15px] border-[1.5px] bg-surface px-4 py-[13px]",
        error ? "border-neg" : "border-primary-light",
        className,
      )}
    >
      <input
        ref={ref}
        className="w-full bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted"
        {...rest}
      />
      {suffix && <span className="shrink-0 text-[13px] font-bold text-muted">{suffix}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-none rounded-[15px] border-[1.5px] border-primary-light bg-surface px-4 py-3 text-[14px] font-medium leading-relaxed text-ink outline-none placeholder:text-muted",
          className,
        )}
        {...rest}
      />
    );
  },
);

// ----------------------- Chip -----------------------
export function Chip({
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
        "rounded-full px-[14px] py-[9px] text-[13px] font-bold transition active:scale-95",
        active
          ? "bg-primary text-white"
          : "border-[1.5px] border-primary-light bg-bg font-semibold text-muted",
      )}
    >
      {children}
    </button>
  );
}

// ----------------------- Segmented control -----------------------
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-[14px] bg-primary-light p-[5px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-[11px] py-[9px] text-center text-[14px] transition",
              active ? "bg-surface font-extrabold text-ink shadow-soft" : "font-bold text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------- Spinner -----------------------
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "aura-spin inline-block rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-label="Завантаження"
    />
  );
}

export function FullLoader({ label = "Завантаження…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
      <Spinner className="h-7 w-7 text-primary" />
      <span className="text-[13px] font-bold">{label}</span>
    </div>
  );
}

// ----------------------- Skeleton -----------------------
/**
 * Плейсхолдер контенту. Розмір і форму задає викликач через `className` —
 * примітив нічого не знає про конкретні картки.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("aura-pulse block rounded-[8px] bg-primary-light", className)}
    />
  );
}

// ----------------------- Empty state -----------------------
export function EmptyState({
  emoji = "🌱",
  title,
  hint,
}: {
  emoji?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl2 bg-surface px-6 py-10 text-center shadow-card">
      <div className="text-[34px]">{emoji}</div>
      <div className="text-[15px] font-extrabold text-ink">{title}</div>
      {hint && <div className="max-w-[240px] text-[13px] font-medium text-muted">{hint}</div>}
    </div>
  );
}

// ----------------------- Error banner -----------------------
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border-[1.5px] border-neg/40 bg-neg/10 px-4 py-3 text-[13px] font-bold text-neg">
      {children}
    </div>
  );
}

// ----------------------- Collapsible -----------------------
export function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl2 bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-[15px] font-extrabold text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 text-[12px] font-semibold text-muted">{subtitle}</div>}
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        >
          <path d="M5 8l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="border-t border-primary-light px-4 pb-4 pt-4">{children}</div>}
    </div>
  );
}

// ----------------------- Bottom sheet -----------------------
/**
 * Модальна панель знизу. Про свій вміст нічого не знає.
 * Закриття: Esc, тап по затемненню, хрестик. Свайп вниз не підтримується.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // onClose живе в ref, а не в залежностях: інлайнова стрілка від викликача
  // інакше перезапускала б ефект щорендера — з переїздом фокуса й
  // сіпанням overflow на body.
  const closeRef = useRef(onClose);
  // Навмисне синхронне оновлення ref щорендера (а не в useEffect), щоб
  // closeRef.current був актуальним ще до першого ефекту. Стандартний
  // патерн "latest ref"; нове правило react-compiler хибно вважає його
  // помилкою — відключаємо точково.
  // eslint-disable-next-line react-hooks/refs
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="aura-fade fixed inset-0 z-50 flex items-end bg-black/40"
      onClick={() => closeRef.current()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "aura-sheet mx-auto w-full max-w-app rounded-t-[24px] bg-surface p-5 outline-none",
          "pb-[max(20px,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[17px] font-extrabold text-ink">{title}</div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Закрити"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-[15px] font-bold text-primary active:scale-95"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
