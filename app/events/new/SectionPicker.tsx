"use client";

import { useState } from "react";
import { CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Section = { id: string; name: string };

export function SectionPicker({
  year1,
  year2,
}: {
  year1: Section[];
  year2: Section[];
}) {
  const allSections = [...year1, ...year2];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(sections: Section[]) {
    const ids = sections.map((s) => s.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === allSections.length) setSelected(new Set());
    else setSelected(new Set(allSections.map((s) => s.id)));
  }

  const allSelected = selected.size === allSections.length && allSections.length > 0;
  const y1All = year1.every((s) => selected.has(s.id));
  const y2All = year2.every((s) => selected.has(s.id));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Who can attend?
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            {selected.size === 0
              ? "all students (none selected)"
              : `${selected.size} class${selected.size > 1 ? "es" : ""} selected`}
          </span>
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition",
            allSelected
              ? "bg-primary/10 text-primary"
              : "border border-border text-muted-foreground hover:bg-accent",
          )}
        >
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Hidden inputs for form submission */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="sections[]" value={id} />
      ))}

      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {/* Year 1 */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Year 1</p>
            <button
              type="button"
              onClick={() => toggleGroup(year1)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold transition",
                y1All ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary",
              )}
            >
              {y1All ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {year1.map((s) => {
              const on = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    on
                      ? "border-primary bg-primary/8 text-primary dark:bg-primary/12"
                      : "border-border text-foreground hover:border-primary/40 hover:bg-accent",
                  )}
                >
                  {on && <span className="mr-1">✓</span>}{s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Year 2 */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Year 2</p>
            <button
              type="button"
              onClick={() => toggleGroup(year2)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-semibold transition",
                y2All ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary",
              )}
            >
              {y2All ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {year2.map((s) => {
              const on = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    on
                      ? "border-primary bg-primary/8 text-primary dark:bg-primary/12"
                      : "border-border text-foreground hover:border-primary/40 hover:bg-accent",
                  )}
                >
                  {on && <span className="mr-1">✓</span>}{s.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
