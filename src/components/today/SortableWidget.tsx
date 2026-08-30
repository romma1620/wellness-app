"use client";

import { Icon } from "@/components/icons";
import type { WidgetId } from "@/lib/home-widgets";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import type { CSSProperties, ReactNode } from "react";

/**
 * Обгортка картки «Сьогодні» в режимі редагування.
 *
 * Тягнути можна лише за ручку, а не за всю картку: інакше `touch-action: none`,
 * якого вимагає pointer-drag, зʼїв би вертикальний скрол — а екран довший за
 * вікно, і перетасувати нижні картки стало б неможливо. Ручка — справжня
 * кнопка, тож dnd-kit дає до неї ще й клавіатурний режим.
 *
 * Поза режимом редагування хук лишається змонтованим, але вимкненим
 * (`disabled`), тож картка поводиться як звичайний div і не перехоплює тапи
 * по полях усередині.
 */
export function SortableWidget({
  id,
  title,
  editing,
  children,
}: {
  id: WidgetId;
  /** Назва картки — читається у скрінрідері з ручки. */
  title: string;
  editing: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  // Тільки вісь Y: список одноколонковий, а горизонтальний зсув усе одно
  // зрізав би модифікатор.
  const style: CSSProperties = {
    transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative rounded-xl2", isDragging && "z-10 shadow-up")}
    >
      {/* Вміст у режимі редагування не клікабельний: тап по картці має
          починати перетягування чи нічого, а не відкривати клавіатуру. */}
      <div className={cn(editing && "pointer-events-none select-none", isDragging && "opacity-95")}>
        {children}
      </div>

      {editing && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Перемістити картку «${title}»`}
          style={{ touchAction: "none" }}
          className={cn(
            // Кут винесено ЗА картку: у шапках праворуч уже стоять бейджі
            // (дельта ваги, ціль кроків, «6 / 8 склянок»), і ручка всередині
            // накривала б їх.
            "absolute -right-[7px] -top-[7px] flex h-[28px] w-[28px] items-center justify-center",
            "rounded-full border border-line bg-bg transition",
            isDragging ? "text-accent" : "text-muted active:scale-95",
          )}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={15} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
