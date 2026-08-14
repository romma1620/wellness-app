import { avg } from "@/lib/utils";
import { setTonnage } from "@/lib/workouts";

/** День щоденника в обсязі, потрібному тижневому звіту. */
export interface ReportDay {
  date: string;
  weight: number | null;
  kcal: number | null;
  water: number | null;
  steps: number | null;
  sport: string | null;
  care: string | null;
  comment: string | null;
}

export interface WeekStats {
  avgWeight: number | null;
  /** Кг проти минулого тижня; для ваги кілограми чесніші за відсотки. */
  weightDiff: number | null;
  avgKcal: number | null;
  avgWater: number | null;
  avgSteps: number | null;
  /** Днів, у яких записано хоч щось. */
  daysLogged: number;
}

function hasAnything(d: ReportDay): boolean {
  return (
    d.weight != null ||
    d.kcal != null ||
    d.water != null ||
    d.steps != null ||
    !!d.sport ||
    !!d.care ||
    !!d.comment
  );
}

/** Підсумок тижня щоденника проти попереднього. */
export function weekStats(cur: ReportDay[], prev: ReportDay[]): WeekStats {
  const avgWeight = avg(cur.map((d) => d.weight));
  const prevWeight = avg(prev.map((d) => d.weight));
  return {
    avgWeight,
    weightDiff: avgWeight != null && prevWeight != null ? avgWeight - prevWeight : null,
    avgKcal: avg(cur.map((d) => d.kcal)),
    avgWater: avg(cur.map((d) => d.water)),
    avgSteps: avg(cur.map((d) => d.steps)),
    daysLogged: cur.filter(hasAnything).length,
  };
}

export interface SessionsSummary {
  sessions: number;
  tonnage: number;
}

/** Кількість сесій і сумарний тоннаж тижня. */
export function sessionsSummary(
  workouts: { sets: { weight: number | null; reps: number }[] }[],
): SessionsSummary {
  return {
    sessions: workouts.length,
    tonnage: workouts.reduce(
      (sum, w) => sum + w.sets.reduce((s, set) => s + setTonnage(set), 0),
      0,
    ),
  };
}
