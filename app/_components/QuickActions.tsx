import Link from "next/link";
import type { ReactNode } from "react";

export function QuickActions({
  actions,
}: {
  actions: { href: string; label: string; icon: ReactNode; desc?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((a) => (
        <Link
          key={a.href + a.label}
          href={a.href}
          className="group rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary/15">
            {a.icon}
          </span>
          <p className="text-sm font-semibold text-foreground">{a.label}</p>
          {a.desc && <p className="mt-0.5 text-xs text-muted-foreground">{a.desc}</p>}
        </Link>
      ))}
    </div>
  );
}
