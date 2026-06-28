"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle, UserPlus, RefreshCw, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { importStudentsPreviewed } from "./actions";

type ClassOption = { id: string; name: string; enrolled: number };

type PreviewRow = {
  line: number;
  email: string;
  name: string;
  status: "new" | "exists" | "already_enrolled" | "invalid";
  reason?: string;
};

const STATUS_CONFIG = {
  new:              { icon: UserPlus,      label: "New student",       cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/8" },
  exists:           { icon: RefreshCw,     label: "Re-enroll",         cls: "text-primary",                          bg: "bg-primary/8"     },
  already_enrolled: { icon: CheckCircle2,  label: "Already enrolled",  cls: "text-muted-foreground",                 bg: ""                 },
  invalid:          { icon: AlertTriangle, label: "Invalid row",        cls: "text-red-600 dark:text-red-400",        bg: "bg-red-500/8"     },
};

function parsePreview(csv: string): Omit<PreviewRow, "status" | "reason">[] {
  return csv
    .split(/\r?\n/)
    .map((l, i) => ({ raw: l.trim(), lineNum: i + 1 }))
    .filter((r) => r.raw)
    .map(({ raw, lineNum }) => {
      const [emailRaw, ...rest] = raw.split(",");
      const email = (emailRaw ?? "").toLowerCase().trim();
      const name = rest.join(",").trim() || email.split("@")[0] || "";
      return { line: lineNum, email, name };
    });
}

export function ImportForm({ classes }: { classes: ClassOption[] }) {
  const [csv, setCsv] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [password, setPassword] = useState("stud123");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [result, setResult] = useState<{ created: number; enrolled: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = parsePreview(csv);
  const hasContent = parsed.length > 0;

  async function buildPreview() {
    if (!classSectionId || !hasContent) return;
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classSectionId, rows: parsed }),
      });
      const data = await res.json();
      setPreview(data.rows as PreviewRow[]);
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsv(String(ev.target?.result ?? ""));
      setPreview(null);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const content = "phone,name\n9876543210,Rahul Sharma\n9123456789,Priya Das\n8012345678,Amit Roy\n";
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function confirmImport() {
    if (!preview || !classSectionId) return;
    const fd = new FormData();
    fd.append("classSectionId", classSectionId);
    fd.append("csv", csv);
    fd.append("defaultPassword", password);
    startTransition(async () => {
      const res = await importStudentsPreviewed(fd);
      setResult(res);
      setPreview(null);
      setCsv("");
    });
  }

  const newCount = preview?.filter((r) => r.status === "new").length ?? 0;
  const reEnrollCount = preview?.filter((r) => r.status === "exists").length ?? 0;
  const skipCount = preview?.filter((r) => r.status === "invalid" || r.status === "already_enrolled").length ?? 0;

  return (
    <div className="space-y-5">
      {/* Step 1 — Input */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-foreground">Step 1 — Paste students or upload a CSV</p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={classSectionId}
            onChange={(e) => { setClassSectionId(e.target.value); setPreview(null); }}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            required
          >
            <option value="">Select class to enroll into…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.enrolled} enrolled)
              </option>
            ))}
          </select>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> Upload CSV
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Template
          </button>
        </div>

        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setPreview(null); setResult(null); }}
          rows={7}
          placeholder={"9876543210,Rahul Sharma\n9123456789,Priya Das\n8012345678,Amit Roy"}
          className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Default password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-28 rounded-md border border-input bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            {hasContent && (
              <span className="text-xs text-muted-foreground">{parsed.length} row{parsed.length !== 1 ? "s" : ""} detected</span>
            )}
            <button
              type="button"
              onClick={buildPreview}
              disabled={!classSectionId || !hasContent || loadingPreview}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
            >
              {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Preview import
            </button>
          </div>
        </div>
      </div>

      {/* Step 2 — Preview table */}
      {preview && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Step 2 — Review before importing</p>
            <div className="flex items-center gap-3 text-xs">
              {newCount > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{newCount} new</span>}
              {reEnrollCount > 0 && <span className="text-primary">{reEnrollCount} re-enroll</span>}
              {skipCount > 0 && <span className="text-muted-foreground">{skipCount} skip</span>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">#</th>
                  <th className="px-4 py-2.5 text-left font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((row) => {
                  const cfg = STATUS_CONFIG[row.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={row.line} className={cn(row.status === "invalid" && "bg-red-500/5", row.status === "already_enrolled" && "opacity-60")}>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{row.line}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.email || <span className="text-red-500">missing</span>}</td>
                      <td className="px-4 py-2.5 text-foreground">{row.name || <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", cfg.cls)}>
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                          {row.reason && <span className="text-muted-foreground">· {row.reason}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={confirmImport}
              disabled={pending || (newCount + reEnrollCount === 0)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm — import {newCount + reEnrollCount} student{newCount + reEnrollCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Import complete
          </p>
          <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
            {result.created} new account{result.created !== 1 ? "s" : ""} created ·{" "}
            {result.enrolled} enrolled ·{" "}
            {result.skipped} skipped
          </p>
        </div>
      )}

      {/* Format hint */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Format: <code className="font-mono">phone,name</code> — one student per line. Phone must be 10–12 digits.</p>
        <p className="mt-1">Students log in with their phone number + the default password. Existing students (matched by phone) are re-enrolled without changing their password.</p>
      </div>
    </div>
  );
}
