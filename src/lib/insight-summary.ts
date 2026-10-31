import type { PairAnalysis } from "./correlations";
import type { OriPose } from "./mascot";
import { plural } from "./utils";

/** Підсумок Орі над картками інсайтів: скільки звʼязків знайдено серед пар. */
export function insightSummary(states: PairAnalysis["state"][]): {
  pose: OriPose;
  title: string;
  text: string;
} {
  const links = states.filter((s) => s === "link").length;
  if (links > 0) {
    return {
      pose: "happy",
      title: `Знайшли ${links} ${plural(links, "звʼязок", "звʼязки", "звʼязків")}`,
      text: "Ось що працює саме для тебе",
    };
  }
  if (states.every((s) => s === "collecting")) {
    return {
      pose: "idle",
      title: "Ще збираємо дані",
      text: "Заповнюй щоденник — висновки зʼявляться з часом",
    };
  }
  return {
    pose: "idle",
    title: "Явних звʼязків поки не видно",
    text: "Це теж чесна відповідь — дивись деталі нижче",
  };
}
