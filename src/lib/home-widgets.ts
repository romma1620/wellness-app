/**
 * Порядок карток на «Сьогодні».
 *
 * Порядок живе в профілі (`profiles.home_widgets`), тож їде за акаунтом на
 * всі пристрої — як тема. Але БД не гарантує, що збережений масив досі
 * відповідає коду: віджет могли перейменувати, прибрати або додати новий уже
 * після того, як юзер перетасував екран. Тому все, що приходить ззовні,
 * проходить через `normalizeOrder` — вона не валідує, а ремонтує: невідоме
 * викидає, відсутнє дописує в кінець. Ефект: новий віджет зʼявляється внизу
 * екрана, а не ламає розкладку й не зникає зовсім.
 */

export type WidgetId = "weight" | "steps" | "water" | "nutrition" | "activity" | "note";

/** Порядок «з коробки» — він же джерело правди про повний набір віджетів. */
export const DEFAULT_WIDGET_ORDER: readonly WidgetId[] = [
  "weight",
  "steps",
  "water",
  "nutrition",
  "activity",
  "note",
];

const KNOWN = new Set<string>(DEFAULT_WIDGET_ORDER);

export function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && KNOWN.has(value);
}

/**
 * Будь-яке значення з БД чи кешу → повний порядок без повторів.
 *
 * Порожній масив і не-масив читаються однаково: «юзер нічого не налаштовував».
 */
export function normalizeOrder(raw: unknown): WidgetId[] {
  const seen = new Set<WidgetId>();
  const out: WidgetId[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isWidgetId(item) || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  for (const id of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/**
 * Перенести `active` на місце `over` зі зсувом решти — рівно те, що показує
 * dnd-kit під час перетягування. Невідомий id лишає порядок без змін, щоб
 * випадковий drop у порожнечу не перемішував екран.
 */
export function reorder(order: readonly WidgetId[], active: string, over: string): WidgetId[] {
  const from = order.indexOf(active as WidgetId);
  const to = order.indexOf(over as WidgetId);
  if (from < 0 || to < 0 || from === to) return [...order];
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Чи змінився порядок — щоб не слати в БД запис, який нічого не міняє. */
export function sameOrder(a: readonly WidgetId[], b: readonly WidgetId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
