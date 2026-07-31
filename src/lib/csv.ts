/**
 * Збірка CSV для експорту даних. Чиста логіка: без React і без Supabase.
 *
 * Діалект підібраний під локалі з десятковою комою (uk-UA): роздільник полів
 * `;`, десятковий роздільник — кома. Тому кома всередині значення
 * ("Скраб, Крем") не потребує екранування.
 */

const DELIMITER = ";";
const EOL = "\r\n";

export type CsvValue = string | number | null | undefined;

/** Повне значення з комою: не fmt() — той округлює й ставить розділювач тисяч. */
function numToCsv(n: number): string {
  return String(n).replace(".", ",");
}

export function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "number" ? (Number.isFinite(value) ? numToCsv(value) : "") : value;
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvField).join(DELIMITER)).join(EOL);
}
