/**
 * Калькулятор «сире ↔ готове». Продукт міняє вагу при готуванні: мʼясо
 * втрачає воду, крупи й макарони вбирають її. Щоб записати в щоденник
 * калорії з етикетки (вони завжди на суху / сиру вагу), треба знати, скільки
 * сирого продукту припало на кожну готову порцію. Нічого не зберігається.
 */

export type FoodGroup = "meat" | "grain" | "other";

export interface FoodPreset {
  id: string;
  label: string;
  group: FoodGroup;
  /**
   * Типовий коефіцієнт «готове / сире». Лише для орієнтовної оцінки, коли
   * сиру вагу не зважили: реальний увар залежить від способу готування.
   */
  ratio: number | null;
}

export const FOOD_PRESETS: FoodPreset[] = [
  { id: "chicken-breast", label: "Куряче філе", group: "meat", ratio: 0.7 },
  { id: "chicken-thigh", label: "Курячі стегна", group: "meat", ratio: 0.7 },
  { id: "turkey", label: "Індичка", group: "meat", ratio: 0.7 },
  { id: "beef", label: "Яловичина", group: "meat", ratio: 0.65 },
  { id: "pork", label: "Свинина", group: "meat", ratio: 0.7 },
  { id: "mince", label: "Фарш", group: "meat", ratio: 0.75 },
  { id: "fish", label: "Риба", group: "meat", ratio: 0.8 },
  { id: "buckwheat", label: "Гречка", group: "grain", ratio: 2.6 },
  { id: "rice", label: "Рис", group: "grain", ratio: 2.8 },
  { id: "pasta", label: "Макарони", group: "grain", ratio: 2.3 },
  { id: "oats", label: "Вівсянка", group: "grain", ratio: 3 },
  { id: "bulgur", label: "Булгур", group: "grain", ratio: 2.6 },
  { id: "quinoa", label: "Кіноа", group: "grain", ratio: 2.7 },
  { id: "lentils", label: "Сочевиця", group: "grain", ratio: 2.5 },
  { id: "legumes", label: "Нут / квасоля", group: "grain", ratio: 2.2 },
  { id: "potato", label: "Картопля", group: "other", ratio: 0.8 },
  { id: "veggies", label: "Овочі (запечені)", group: "other", ratio: 0.7 },
  { id: "custom", label: "Інше", group: "other", ratio: null },
];

export interface FoodCalcInput {
  /** Сира (суха) вага всього продукту, г. */
  raw: number | null;
  /**
   * Готові порції, г. Уся страва розкладена на них, тож їхня сума — це вся
   * готова вага. Порожні поля пропускаються.
   */
  portions: (number | null)[];
  /** Типовий коефіцієнт продукту — запасний варіант, якщо `raw` нема. */
  presetRatio: number | null;
}

export interface PortionResult {
  /** Індекс у вхідному масиві — щоб рядок результату збігся з полем. */
  index: number;
  cooked: number;
  raw: number;
}

export type FoodCalcResult =
  | { status: "empty" }
  | {
      status: "ok";
      /** true — рахували за типовим коефіцієнтом, а не за зважуванням. */
      estimated: boolean;
      /** Коефіцієнт «готове / сире». */
      ratio: number;
      portions: PortionResult[];
      portionsCooked: number;
      portionsRaw: number;
    };

const pos = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

export function calcFood(input: FoodCalcInput): FoodCalcResult {
  const portions: { index: number; cooked: number }[] = [];
  input.portions.forEach((p, index) => {
    if (pos(p)) portions.push({ index, cooked: p });
  });
  if (portions.length === 0) return { status: "empty" };
  const portionsCooked = portions.reduce((s, p) => s + p.cooked, 0);

  let ratio: number;
  let estimated = false;
  if (pos(input.raw)) {
    ratio = portionsCooked / input.raw;
  } else if (pos(input.presetRatio)) {
    ratio = input.presetRatio;
    estimated = true;
  } else {
    return { status: "empty" };
  }

  return {
    status: "ok",
    estimated,
    ratio,
    portions: portions.map((p) => ({ ...p, raw: p.cooked / ratio })),
    portionsCooked,
    portionsRaw: portionsCooked / ratio,
  };
}

// ----------------------- Складна страва -----------------------
/*
 * Страва з кількох інгредієнтів (курка в кисло-солодкому): зважуєш кожен
 * інгредієнт сирим, потім готові порції. Кожна порція — частка всієї готової
 * страви, тож і кожного інгредієнта в ній рівно стільки ж відсотків.
 */

export interface DishIngredientInput {
  name: string;
  /** Сира (суха) вага інгредієнта, г. */
  raw: number | null;
}

export interface DishCalcInput {
  ingredients: DishIngredientInput[];
  /** Готові порції, г. Порожні поля пропускаються. */
  portions: (number | null)[];
}

export interface DishIngredient {
  /** Індекс у вхідному масиві. */
  index: number;
  /** Назва; якщо не вписана — «Інгредієнт N». */
  name: string;
  raw: number;
}

export interface DishPortion {
  index: number;
  cooked: number;
  /** Частка порції в усій готовій страві, 0…1. */
  share: number;
  /** Сира вага всіх інгредієнтів у порції. */
  raw: number;
  /** Скільки кожного інгредієнта в порції — у порядку `ingredients`. */
  items: { index: number; name: string; raw: number }[];
}

export type DishCalcResult =
  | { status: "empty" }
  | {
      status: "ok";
      ingredients: DishIngredient[];
      portions: DishPortion[];
      /** Сума сирих інгредієнтів. */
      totalRaw: number;
      /** Уся готова страва — сума порцій. */
      totalCooked: number;
      /** Коефіцієнт «готове / сире» для всієї страви. */
      ratio: number;
    };

export function calcDish(input: DishCalcInput): DishCalcResult {
  const ingredients: DishIngredient[] = [];
  input.ingredients.forEach((ing, index) => {
    if (pos(ing.raw)) {
      ingredients.push({ index, name: ing.name.trim() || `Інгредієнт ${index + 1}`, raw: ing.raw });
    }
  });
  const portions: { index: number; cooked: number }[] = [];
  input.portions.forEach((p, index) => {
    if (pos(p)) portions.push({ index, cooked: p });
  });
  if (ingredients.length === 0 || portions.length === 0) return { status: "empty" };

  const totalRaw = ingredients.reduce((s, i) => s + i.raw, 0);
  const totalCooked = portions.reduce((s, p) => s + p.cooked, 0);

  return {
    status: "ok",
    ingredients,
    totalRaw,
    totalCooked,
    ratio: totalCooked / totalRaw,
    portions: portions.map((p) => {
      const share = p.cooked / totalCooked;
      return {
        ...p,
        share,
        raw: totalRaw * share,
        items: ingredients.map((i) => ({ index: i.index, name: i.name, raw: i.raw * share })),
      };
    }),
  };
}
