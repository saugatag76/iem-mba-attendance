"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, CheckCircle2, AlertTriangle, PlusCircle, Pencil, MinusCircle, X, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyRoutineImport } from "./routine-import-actions";

type DiffRow = {
  type: "add" | "update" | "remove-deleted" | "remove-kept";
  section: string;
  day: string;
  slotIndex: number;
  subgroup: string | null;
  before: string | null;
  after: string | null;
  historyCount?: number;
};

type PreviewResult = {
  subjectsCount: number;
  offeringsCount: number;
  scheduleCount: number;
  added: number;
  updated: number;
  unchanged: number;
  removedKept: number;
  removedDeleted: number;
  rows: DiffRow[];
  unresolvedSubjects: string[];
  newTeacherInitials: string[];
  skippedOtherSections: number;
};

const ROW_CONFIG = {
  add:             { icon: PlusCircle, label: "Add",     cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5" },
  update:          { icon: Pencil,     label: "Update",  cls: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/5"   },
  "remove-kept":   { icon: MinusCircle, label: "Clear (history kept)", cls: "text-muted-foreground",    bg: ""                 },
  "remove-deleted": { icon: MinusCircle, label: "Remove", cls: "text-red-600 dark:text-red-400",         bg: "bg-red-500/5"     },
};

export function RoutineImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; updated: number; unchanged: number; removedKept: number; removedDeleted: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function buildPreview() {
    if (!file) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/routine-import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Preview failed."); return; }
      setPreview(data as PreviewResult);
    } catch {
      setError("Preview failed — check the file and try again.");
    } finally {
      setLoadingPreview(false);
    }
  }

  function confirmImport() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await applyRoutineImport(fd);
      setResult(res);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  const changeCount = preview ? preview.added + preview.updated + preview.removedKept + preview.removedDeleted : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-1 text-sm font-semibold text-foreground">Import routine from Excel</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Upload the timetable workbook (same template used for the initial setup). Nothing is written until you confirm — existing substitution history is never lost.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> {file ? file.name : "Choose file…"}
          </button>
          <button
            type="button"
            onClick={buildPreview}
            disabled={!file || loadingPreview}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
          >
            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Preview import
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {preview && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Review before importing</p>
            <div className="flex items-center gap-3 text-xs">
              {preview.added > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{preview.added} add</span>}
              {preview.updated > 0 && <span className="text-amber-600 dark:text-amber-400">{preview.updated} update</span>}
              {preview.removedDeleted > 0 && <span className="text-red-600 dark:text-red-400">{preview.removedDeleted} remove</span>}
              {preview.removedKept > 0 && <span className="text-muted-foreground">{preview.removedKept} clear (history)</span>}
              <span className="text-muted-foreground">{preview.unchanged} unchanged</span>
            </div>
          </div>

          {(preview.unresolvedSubjects.length > 0 || preview.newTeacherInitials.length > 0) && (
            <div className="border-b border-border bg-amber-500/8 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              {preview.unresolvedSubjects.length > 0 && (
                <p>New/unrecognized subjects (will be created as generic activities): {preview.unresolvedSubjects.join(", ")}</p>
              )}
              {preview.newTeacherInitials.length > 0 && (
                <p>New teacher initials not in the known faculty list (their initials will be used as their name): {preview.newTeacherInitials.join(", ")}</p>
              )}
            </div>
          )}

          {changeCount === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No changes — this file matches what's already live.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <span>{expanded ? "Hide" : "Show"} {changeCount} change{changeCount === 1 ? "" : "s"}</span>
                <ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} />
              </button>
              {expanded && (
                <div className="max-h-96 overflow-y-auto border-t border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-left font-medium">Section</th>
                        <th className="px-4 py-2 text-left font-medium">Day / Slot</th>
                        <th className="px-4 py-2 text-left font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.rows
                        .map((r, i) => {
                          const cfg = ROW_CONFIG[r.type];
                          const Icon = cfg.icon;
                          return (
                            <tr key={i} className={cfg.bg}>
                              <td className="px-4 py-2">
                                <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cfg.cls)}>
                                  <Icon className="h-3.5 w-3.5" /> {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-foreground">{r.section}</td>
                              <td className="px-4 py-2 text-muted-foreground">{r.day} slot{r.slotIndex}{r.subgroup ? ` (${r.subgroup})` : ""}</td>
                              <td className="px-4 py-2 text-foreground">
                                {r.type === "add" && r.after}
                                {r.type === "update" && <>{r.before} <span className="text-muted-foreground">→</span> {r.after}</>}
                                {r.type === "remove-deleted" && r.before}
                                {r.type === "remove-kept" && (
                                  <>
                                    {r.before}{" "}
                                    <span className="text-xs text-muted-foreground">({r.historyCount} substitution record{r.historyCount === 1 ? "" : "s"} kept)</span>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => { setPreview(null); setExpanded(false); }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={confirmImport}
              disabled={pending || changeCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm — apply {changeCount} change{changeCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Routine updated
          </p>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
            {result.added} added · {result.updated} updated · {result.removedKept} cleared (history kept) · {result.removedDeleted} removed
          </p>
        </div>
      )}
    </div>
  );
}
