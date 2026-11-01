import type { Exercise } from "@/lib/types";
import { newDraftExercise, type DraftExercise } from "@/lib/workouts";

/**
 * Парсер тренування, вставленого текстом цілком — як його пишуть у нотатках
 * чи месенджері. Зазвичай вправа на рядок, але й злиті в один рядок вправи
 * розділяються (див. splitExercises):
 *
 *   Румунська тяга 60 кг 4 х 10
 *   Підтягування 3 х 6 ( максимально швидко догори )
 *   Жим лежачи 45 кг 3 х 12/10/8
 *
 * Розпізнає «підходи × повтори» (х, x, ×, *), вагу з «кг»/«kg» або без
 * одиниці перед підходами, дробову вагу з комою, повтори по підходах через
 * «/» чи «,». Текст у дужках і хвіст після повторів іде в коментар.
 * Рядки без «підходи × повтори» не вгадуються, а повертаються як нерозпізнані.
 */

export interface ParsedExercise {
  name: string;
  /** null — без ваги (власна вага) */
  weight: number | null;
  /** повтори по кожному підходу; довжина = кількість підходів */
  reps: number[];
  note: string | null;
}

export interface ParseResult {
  exercises: ParsedExercise[];
  /** непорожні рядки, з яких не вдалося дістати вправу */
  skipped: string[];
}

const MAX_SETS = 20;
const MAX_REPS = 999;
const MAX_WEIGHT = 999;

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(?:кг|kg|кгр)\.?`;
// підходи × повтори; повтори можуть бути списком «12/10/8»
const SETS_REPS = new RegExp(
  String.raw`(\d+)\s*[xх×*]\s*(\d+(?:\s*[/,]\s*\d+)*)(?![\d.,]*\s*${UNIT})`,
  "iu",
);
// вага в кінці частини перед підходами: «60 кг», «7,5кг», «60»
const WEIGHT_TAIL = new RegExp(String.raw`(${NUM})\s*(${UNIT})?\s*[-–—:,]?\s*$`, "iu");
// вага з одиницею будь-де після повторів: «4 х 10 по 60 кг»
const WEIGHT_UNIT = new RegExp(String.raw`(?:по\s*)?(${NUM})\s*${UNIT}`, "iu");
// маркери списку на початку рядка: «1.», «2)», «-», «•», «*», «—»
const LIST_MARKER = /^\s*(?:\d+\s*[.)]\s+|[-–—•*·]\s*)/u;

function toNumber(raw: string): number {
  return Number(raw.replace(",", "."));
}

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:,.;]+|[\s\-–—:,;]+$/gu, "")
    .trim();
}

export function parseWorkoutLine(line: string): ParsedExercise | null {
  const notes: string[] = [];
  // коментарі в дужках виносимо одразу, щоб числа в них не плутали розбір
  let text = line.replace(/\(([^()]*)\)?/gu, (_, inner: string) => {
    const t = cleanText(inner ?? "");
    if (t) notes.push(t);
    return " ";
  });
  text = text.replace(LIST_MARKER, "");

  const m = SETS_REPS.exec(text);
  if (!m) return null;

  const sets = Number(m[1]);
  const repsList = m[2].split(/[/,]/).map((r) => Number(r.trim()));
  if (sets < 1 || sets > MAX_SETS) return null;
  if (repsList.some((r) => !Number.isFinite(r) || r < 1 || r > MAX_REPS)) return null;
  // «3 х 12/10/8» — по підходу; список коротший за підходи добиваємо останнім
  const reps = Array.from({ length: sets }, (_, i) => repsList[Math.min(i, repsList.length - 1)]);

  let before = text.slice(0, m.index);
  let after = text.slice(m.index + m[0].length);

  let weight: number | null = null;
  const wTail = WEIGHT_TAIL.exec(before);
  // число без одиниці вважаємо вагою, лише якщо перед ним лишається назва
  if (wTail && (wTail[2] || cleanText(before.slice(0, wTail.index)))) {
    weight = toNumber(wTail[1]);
    before = before.slice(0, wTail.index);
  } else {
    const wAfter = WEIGHT_UNIT.exec(after);
    if (wAfter) {
      weight = toNumber(wAfter[1]);
      after = after.slice(0, wAfter.index) + " " + after.slice(wAfter.index + wAfter[0].length);
    }
  }
  if (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT)) {
    return null;
  }
  // нуль кілограмів — це та сама власна вага
  if (weight === 0) weight = null;

  const name = cleanText(before);
  if (!name) return null;

  const tail = cleanText(after);
  if (tail) notes.unshift(tail);

  return { name, weight, reps, note: notes.length ? notes.join("; ") : null };
}

const SETS_REPS_ALL = new RegExp(SETS_REPS.source, "giu");

/**
 * Ділить рядок, у якому кілька вправ підряд (тренування, скопійоване з
 * месенджера без переносів): кожна вправа закінчується своїм «підходи ×
 * повтори» і коментарем у дужках одразу за ним. Дужки маскуються, щоб
 * «35 кг 3 х 8» всередині коментаря не рахувалось окремою вправою.
 */
export function splitExercises(line: string): string[] {
  const masked = line.replace(/\([^()]*\)?/gu, (m) => " ".repeat(m.length));
  const cuts: number[] = [];
  for (const m of masked.matchAll(SETS_REPS_ALL)) {
    let end = m.index + m[0].length;
    const paren = /^\s*\([^()]*\)?/u.exec(line.slice(end));
    if (paren) end += paren[0].length;
    cuts.push(end);
  }
  if (cuts.length < 2) return [line];
  // хвіст після останньої вправи лишається при ній (коментар, «по 60 кг»)
  cuts[cuts.length - 1] = line.length;
  const parts: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    const part = line.slice(start, cut).trim();
    if (part) parts.push(part);
    start = cut;
  }
  return parts;
}

export function parseWorkoutText(text: string): ParseResult {
  const exercises: ParsedExercise[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    for (const part of splitExercises(line)) {
      const parsed = parseWorkoutLine(part);
      if (parsed) exercises.push(parsed);
      else skipped.push(part);
    }
  }
  return { exercises, skipped };
}

/**
 * Перетворює розпізнані вправи на чернетки редактора. Назва, що вже є в
 * довіднику (без урахування регістру), прив'язується до нього — з групою
 * м'язів і рекордом; нові назви створяться при збереженні, як і при ручному
 * введенні.
 */
export function parsedToDrafts(parsed: ParsedExercise[], exercises: Exercise[]): DraftExercise[] {
  const byName = new Map(exercises.map((e) => [e.name.trim().toLowerCase(), e]));
  return parsed.map((p) => {
    const known = byName.get(p.name.trim().toLowerCase());
    return {
      ...newDraftExercise(),
      exerciseId: known?.id ?? null,
      name: known?.name ?? p.name,
      muscleGroup: known?.muscle_group ?? null,
      sets: p.reps.map((r) => ({ weight: p.weight, reps: r })),
    };
  });
}

/** Коментарі з дужок — рядками для нотатки сесії: «Вправа — коментар». */
export function parsedNotes(parsed: ParsedExercise[]): string {
  return parsed
    .filter((p) => p.note)
    .map((p) => `${p.name} — ${p.note}`)
    .join("\n");
}

/** Короткий підсумок вправи для превʼю: «60 кг · 4 × 10», «3 × 12/10/8». */
export function parsedSummary(p: ParsedExercise): string {
  const same = p.reps.every((r) => r === p.reps[0]);
  const sr = same ? `${p.reps.length} × ${p.reps[0]}` : `${p.reps.length} × ${p.reps.join("/")}`;
  const w = p.weight != null ? `${String(p.weight).replace(".", ",")} кг · ` : "";
  return w + sr;
}
