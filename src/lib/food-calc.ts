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
