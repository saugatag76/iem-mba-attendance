import type { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {title && <h2 className="mb-3 text-sm font-semibold text-gray-800">{title}</h2>}
      {children}
    </section>
  );
}

export const inputClass =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 w-full";

export function Submit({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white active:scale-[0.98]">
      {children}
    </button>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
