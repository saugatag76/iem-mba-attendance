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
          className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 transition group-hover:bg-brand-100">
            {a.icon}
          </span>
          <p className="text-sm font-semibold text-slate-800">{a.label}</p>
          {a.desc && <p className="mt-0.5 text-xs text-slate-400">{a.desc}</p>}
        </Link>
      ))}
    </div>
  );
}
