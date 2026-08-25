/** Escapes a single CSV field per RFC 4180: wraps it in quotes and doubles
 * any embedded quotes whenever the value contains a comma, quote, or
 * newline. Values are stringified first (Prisma's Decimal type has its own
 * toString, so this also handles money fields correctly). */
function escapeField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Builds a CSV document (header row + data rows) from an array of row
 * objects, in the given column order. Hand-rolled rather than a dependency —
 * CSV is simple enough to get right directly, and this keeps the backend
 * free of an extra npm package for it.
 */
export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeField(row[c])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
