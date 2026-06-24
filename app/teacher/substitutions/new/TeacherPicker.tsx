"use client";

import { useState } from "react";
import { Search, AlertTriangle, Clock } from "lucide-react";
import { Avatar } from "@/app/_components/ui";

export type TeacherOption = {
  id: string;
  name: string;
  email: string;
  hasConflict: boolean;
};

export function TeacherPicker({
  teachers,
  showConflict,
}: {
  teachers: TeacherOption[];
  showConflict: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? teachers.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.email.toLowerCase().includes(query.toLowerCase()),
      )
    : teachers;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* List */}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            No teachers found.
          </p>
        ) : (
          filtered.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/8"
            >
              <input
                type="radio"
                name="substituteTeacherId"
                value={t.id}
                required
                className="accent-primary"
              />
              <Avatar name={t.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.email}</p>
              </div>
              {showConflict && t.hasConflict ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Has class at this time
                </span>
              ) : showConflict ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <Clock className="h-3 w-3" /> Free
                </span>
              ) : null}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
