/** Escapes a single CSV cell — wraps in quotes and doubles internal quotes if it contains a comma, quote, or newline. */
export function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds a full CSV document (header + rows) from arrays of cells. */
export function toCsv(header: (string | number)[], rows: (string | number)[][]): string {
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return lines.join("\n");
}
