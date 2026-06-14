"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export interface FilterDef {
  name: string;
  label: string;
  /** Text for the unselected ("") option. Defaults to "{label}: All". */
  defaultLabel?: string;
  options: { value: string; label: string }[];
}

/**
 * Search + select filters that write to the URL query string. Server pages read
 * `searchParams` and filter/group accordingly — no client data fetching needed.
 */
export function FilterBar({
  searchKey = "q",
  placeholder = "Search…",
  filters = [],
}: {
  searchKey?: string;
  placeholder?: string;
  filters?: FilterDef[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const hasFilters =
    !!params.get(searchKey) || filters.some((f) => params.get(f.name));

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="Search"
          defaultValue={params.get(searchKey) ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => update(searchKey, v), 250);
          }}
          className={`${inputClass} w-full pl-9`}
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.name}
          aria-label={f.label}
          defaultValue={params.get(f.name) ?? ""}
          onChange={(e) => update(f.name, e.target.value)}
          className={inputClass}
        >
          <option value="">{f.defaultLabel ?? `${f.label}: All`}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {hasFilters && (
        <button
          onClick={() => {
            // Preserve the date range (from/to) — "Clear" only resets search/select filters.
            const next = new URLSearchParams();
            for (const key of ["from", "to"]) {
              const v = params.get(key);
              if (v) next.set(key, v);
            }
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
