import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "./types";

const schema = readFileSync(resolve(__dirname, "../../supabase/schema.sql"), "utf8");

/** Значення enum `theme_name` зі схеми (create + подальші alter ... add value). */
function schemaThemes(): string[] {
  const created = schema.match(/create type theme_name as enum \(([^)]*)\)/i);
  const values = created ? [...created[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  for (const m of schema.matchAll(/alter type theme_name add value[^;]*?'([^']+)'/gi)) {
    if (!values.includes(m[1])) values.push(m[1]);
  }
  return values;
}

describe("theme_name enum", () => {
  it("містить кожну тему з THEMES", () => {
    // Тема, відсутня в enum, робить UPDATE profiles.theme невалідним:
    // збереження мовчки падає, а сервер потім повертає стару тему.
    expect(schemaThemes().sort()).toEqual([...THEMES].sort());
  });
});