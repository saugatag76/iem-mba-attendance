import { FileSpreadsheet } from "lucide-react";

/** Downloads one Excel workbook covering every report — Overview, Defaulters,
 *  By Student, Substitutions, and a register sheet per subject that has held
 *  sessions. Shown on every Reports tab. */
export function GlobalExportButton({ qs }: { qs: string }) {
  return (
    <a
      href={`/api/reports/export-all/xlsx${qs}`}
      title="Export everything — every report, one Excel file"
      className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
    >
      <FileSpreadsheet className="h-4 w-4" /> Export all
    </a>
  );
}
