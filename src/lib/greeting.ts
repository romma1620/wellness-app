import type { OriPose } from "./mascot";

export type DayPeriod = "morning" | "day" | "evening" | "night";

/** Межі за локальною годиною юзера: ранок 5–11, день 12–17, вечір 18–22, ніч 23–4. */
export function dayPeriod(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "day";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

export const GREETINGS: Record<DayPeriod, { title: string; pose: OriPose; lines: string[] }> = {
  morning: {
    title: "Доброго ранку",
    pose: "wave",
    lines: [
      "Почнімо день мʼяко",
      "Склянка води — гарний старт",
      "Новий день, нові маленькі кроки",
    ],
  },
  day: {
    title: "Гарного дня",
    pose: "happy",
    lines: [
      "Як ти сьогодні?",
      "Не забувай про воду",
      "Маленькі кроки теж рахуються",
    ],
  },
  evening: {
    title: "Добрий вечір",
    pose: "idle",
    lines: [
      "Як минув твій день?",
      "Час підбити підсумки",
      "Вечір — для себе",
    ],
  },
  night: {
    title: "Доброї ночі",
    pose: "sleepy",
    lines: [
      "Сон — теж турбота про тіло",
      "Час відпочивати",
    ],
  },
};

/**
 * Привітання для години й дня місяця. Підзаголовок обирається за днем, а не
 * випадково: протягом дня він не стрибає між рендерами, а завтра — інший.
 */
export function greetingFor(hour: number, dayOfMonth: number) {
  const { title, pose, lines } = GREETINGS[dayPeriod(hour)];
  return { title, pose, line: lines[dayOfMonth % lines.length] };
}
