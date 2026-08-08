"use client";

import { cn, monthLabel, parseISODate, todayISO, toISODate, weekdayHead } from "@/lib/utils";
import { keyboardInset } from "@/lib/viewport";
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
import { DayPicker, type ClassNames, type DayButtonProps } from "react-day-picker";
import { uk } from "react-day-picker/locale";

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

// ----------------------- DateField -----------------------

/**
 * Дні календаря малюємо самі, а не класами на `<td>`: react-day-picker
 * навішує `selected`/`today`/`outside` на клітинку, а кружечок нам потрібен
 * на кнопці всередині неї. `DayButton` — штатна точка розширення, і вона
 * єдина дає доступ до модифікаторів там, де вони потрібні.
 */
function PickerDay({ day, modifiers, className, children, ...rest }: DayButtonProps) {
  const { selected, today, outside, disabled } = modifiers;
  const ref = useRef<HTMLButtonElement>(null);

  // Дефолтний DayButton робить рівно це, і без нього ламається навігація
  // стрілками: react-day-picker лише позначає день модифікатором focused,
  // а перевести на нього фокус мусить сама кнопка.
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "mx-auto flex h-[38px] w-[38px] items-center justify-center rounded-full text-[14px] transition",
        selected
          ? "bg-primary font-extrabold text-white shadow-soft"
          : today
            ? "font-extrabold text-primary ring-[1.5px] ring-inset ring-primary"
            : "font-bold text-ink",
        outside && !selected && "text-muted opacity-35",
        disabled && "cursor-not-allowed opacity-25",
        !disabled && !selected && "hover:bg-primary-light active:scale-90",
        className,
      )}
    >
      {/* Число дня форматує лібка — воно вже прийшло в children */}
      {children ?? day.date.getDate()}
    </button>
  );
}

const NAV_BUTTON =
  "flex h-[30px] w-[30px] items-center justify-center rounded-[11px] bg-bg text-muted transition active:scale-90 disabled:opacity-30 disabled:active:scale-100";

/**
 * Класи розкладені по елементах react-day-picker, базовий CSS лібки не
 * підключаємо: сітка там — звичайна `<table>`, і Tailwind-у достатньо.
 *
 * Кнопки місяців позиціоновані абсолютно, бо при `navLayout="around"` вони
 * лежать усередині `month` сусідами заголовка — рядок «‹ Серпень 2026 ›»
 * інакше не збереш, не ламаючи сітку під ним.
 */
const PICKER_CLASSES: Partial<ClassNames> = {
  root: "w-full",
  months: "flex w-full flex-col",
  month: "relative w-full",
  button_previous: cn(NAV_BUTTON, "absolute left-0 top-0 z-10"),
  button_next: cn(NAV_BUTTON, "absolute right-0 top-0 z-10"),
  chevron: "h-[18px] w-[18px] fill-current",
  month_caption: "mb-3 flex h-[30px] items-center justify-center",
  caption_label: "text-[15px] font-extrabold",
  month_grid: "w-full border-collapse",
  weekday: "pb-1.5 text-center text-[10.5px] font-extrabold text-muted",
  day: "p-0 py-[2px] text-center align-middle",
};

/**
 * Вибір дати: власний тригер (`children` — те, що видно) і календар
 * react-day-picker у нижній панелі.
 *
 * Нативний `input[type=date]` тут не використовується навмисно. Крім того,
 * що він виглядає по-різному в кожному браузері, у Chrome клік по його полю
 * взагалі не відкриває календар — це робить лише службова іконка, тож
 * прозорий input на всю ширину поля просто не працював.
 */
export function DateField({
  value,
  onChange,
  label,
  min,
  max,
  className,
  children,
}: {
  value: string; // YYYY-MM-DD
  onChange: (v: string) => void;
  /** Заголовок панелі; він же йде в назву тригера для скрінрідера. */
  label: string;
  min?: string;
  max?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);

  // Обмеження прив'язані до дат, а не до місяців: інакше можна долистати
  // до місяця, у якому всі дні заблоковані, і не зрозуміти, чому.
  const limits = [
    ...(min ? [{ before: parseISODate(min) }] : []),
    ...(max ? [{ after: parseISODate(max) }] : []),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        // w-full обовʼязкове: у form-controls `width: auto` рахується як
        // fit-content, тому кнопка стискається по вмісту навіть з display:flex
        // — і `justify-between` у класах викликача не має що розподіляти.
        className={cn("w-full cursor-pointer text-left", className)}
      >
        <span className="sr-only">{label}. </span>
        {children}
      </button>

      {open && (
        <Sheet open onClose={() => setOpen(false)} title={label}>
          <DayPicker
            mode="single"
            required
            selected={selected}
            onSelect={(d) => {
              if (!d) return;
              onChange(toISODate(d));
              setOpen(false);
            }}
            defaultMonth={selected}
            startMonth={min ? parseISODate(min) : undefined}
            endMonth={max ? parseISODate(max) : undefined}
            disabled={limits}
            showOutsideDays
            weekStartsOn={1}
            navLayout="around"
            locale={uk}
            // Назви місяців і днів беремо з утиліт проєкту, а не з локалі
            // date-fns: у застосунку вже є свої формати, і календар не має
            // писати «серпень» там, де решта екранів пише «Серпень».
            formatters={{
              formatCaption: (d) => monthLabel(toISODate(d)),
              formatWeekdayName: (d) => weekdayHead(d.getDay()),
            }}
            classNames={PICKER_CLASSES}
            components={{ DayButton: PickerDay }}
          />
          <button
            type="button"
            onClick={() => {
              onChange(todayISO());
              setOpen(false);
            }}
            className="mt-2 shrink-0 rounded-[14px] bg-primary-light py-3 text-center text-[13.5px] font-extrabold text-primary active:scale-[.99]"
          >
            Сьогодні
          </button>
        </Sheet>
      )}
    </>
  );
}

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

// ----------------------- Toggle -----------------------
/**
 * Перемикач «увімкнено / вимкнено». Це справжній `role="switch"`, а не
 * стилізований чекбокс: перемикачі в застосунку керують станом одразу,
 * без «Зберегти», і скрінрідер має читати їх саме так.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[27px] w-[46px] shrink-0 rounded-[14px] transition-colors",
        checked ? "bg-primary" : "bg-primary-light",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,.2)] transition-[left]",
          checked ? "left-[22px]" : "left-[3px]",
        )}
      />
    </button>
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
 * Висота, на яку клавіатура перекриває низ екрана, у пікселях.
 *
 * Читаємо `visualViewport`, бо на iOS layout-вьюпорт при появі клавіатури не
 * змінюється: `fixed inset-0` лишається на всю висоту екрана, і панель,
 * притиснута до низу, ховається під клавіатурою. Підписка жива лише поки
 * панель відкрита. Перший замір іде через rAF, а не синхронно в тілі ефекту,
 * щоб міряти вже після відмальовки.
 */
function useKeyboardInset(open: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setInset(keyboardInset(window.innerHeight, vv.height, vv.offsetTop));
    const first = requestAnimationFrame(update);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      cancelAnimationFrame(first);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // поки панель закрита, значення з минулого відкриття не має впливати
  return open ? inset : 0;
}

/**
 * Модальна панель знизу. Про свій вміст нічого не знає, але гарантує, що
 * ніколи не вилізе за видиму частину екрана: піднімається над клавіатурою і
 * обмежує свою висоту. Вміст, що не вміщується, скролиться — заголовок ні.
 * Закриття: Esc, тап по затемненню, хрестик. Свайп вниз не підтримується.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /**
   * Другий рядок шапки. Живе саме тут, а не першим елементом `children`:
   * вміст панелі скролиться, і будь-який відʼємний відступ, яким його
   * підтягували б до заголовка, обрізався б об верхню межу скрол-контейнера.
   */
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const bottomInset = useKeyboardInset(open);

  // onClose живе в ref, а не в залежностях: інлайнова стрілка від викликача
  // інакше перезапускала б головний ефект щорендера — з переїздом фокуса й
  // сіпанням overflow на body. Оновлюємо ref окремим ефектом без залежностей
  // (а не прямо в тілі рендера — це порушує чистоту рендера під Strict Mode
  // і конкурентним рендерингом): ефекти виконуються в порядку оголошення, тож
  // ref гарантовано актуальний ще до головного ефекту нижче.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

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
      // паддінг, а не зсув: висота контенту контейнера зменшується разом із
      // видимою областю, тож `max-h` панелі нижче рахується вже від неї
      style={{ paddingBottom: bottomInset }}
      onClick={() => closeRef.current()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        // 24px лишаємо на затемнення зверху, щоб панель читалась як панель,
        // а не як окремий екран
        style={{ maxHeight: "calc(100% - 24px)" }}
        className={cn(
          "aura-sheet mx-auto flex w-full max-w-app flex-col rounded-t-[24px] bg-surface p-5 outline-none",
          "pb-[max(20px,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[17px] font-extrabold text-ink">{title}</div>
            {subtitle && (
              <div className="mt-0.5 text-[12px] font-bold text-muted">{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Закрити"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-[15px] font-bold text-primary active:scale-95"
          >
            ✕
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
