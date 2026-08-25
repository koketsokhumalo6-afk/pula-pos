/** Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas,
 * embedded newlines inside quotes, and doubled-quote escaping. Good enough
 * for a spreadsheet-exported CSV without pulling in an external dependency. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Last field/row — the file may or may not end with a trailing newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Turns parsed CSV rows into objects keyed by the header row, trimming
 * whitespace from both header names and values so minor formatting
 * differences (extra spaces, trailing commas) don't break column matching. */
export function csvRowsToObjects(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

function escapeCsvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Builds a CSV string from column headers + row arrays, entirely
 * client-side — for report data that's already been fetched and summarized
 * (top products, staff performance, …) and so has no dedicated backend
 * export endpoint of its own. Mirrors the backend's toCsv escaping rules. */
export function buildCsv(columns: string[], rows: (string | number)[][]): string {
  const lines = [columns.map(escapeCsvField).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Triggers a browser download of an in-memory CSV string — the
 * client-generated counterpart to lib/download.ts's downloadFile, which
 * fetches a CSV from an authenticated API endpoint instead. */
export function saveCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
