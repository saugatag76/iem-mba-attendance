"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./ui";

/** Caps a list of rows and reveals the rest on click — avoids the `<details>`
 *  pattern, where the "hidden" content stayed visible without a real toggle. */
export function ShowMore({
  items,
  cap,
  itemName = "item",
}: {
  items: ReactNode[];
  cap: number;
  /** Singular noun used in the "Show N more ___" label, e.g. "subject". */
  itemName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = items.length - cap;
  const visible = expanded ? items : items.slice(0, cap);

  return (
    <>
      <ul className="divide-y divide-border">{visible}</ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-primary hover:text-primary/80"
        >
          {expanded ? "Show less" : `Show ${hidden} more ${itemName}${hidden > 1 ? "s" : ""}`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded && "rotate-180")} />
        </button>
      )}
    </>
  );
}
