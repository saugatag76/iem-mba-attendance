import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, cn } from "./ui";

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {action}
    </div>
  );
}

/** Native, JS-free collapsible group (works in server components). */
export function CollapsibleGroup({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
        <span className="flex items-center gap-2">
          {title}
          {count != null && <Badge tone="gray">{count}</Badge>}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100">{children}</div>
    </details>
  );
}

/** Tab navigation between separate routes (server-component friendly). */
export function RouteTabs({
  active,
  tabs,
}: {
  active: string;
  tabs: { label: string; href: string }[];
}) {
  return (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((t) => {
        const isActive = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
              isActive ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Tab navigation driven by a URL query param (server-component friendly). */
export function TabNav({
  basePath,
  param = "tab",
  active,
  tabs,
}: {
  basePath: string;
  param?: string;
  active: string;
  tabs: { label: string; value: string }[];
}) {
  return (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value}
            href={`${basePath}?${param}=${t.value}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
              isActive ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
