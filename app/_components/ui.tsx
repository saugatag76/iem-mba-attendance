import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { FACULTY_INITIALS_BY_NAME } from "@/lib/facultyInitials";

import { cn } from "@/lib/utils";
export { cn };

/* ----------------------------- Button ----------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  secondary: "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
  ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  danger: "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10",
};
const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    VARIANTS[variant],
    SIZES[size],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}

/** Back-compat: a primary submit button. */
export function Submit({ children }: { children: ReactNode }) {
  return <Button type="submit">{children}</Button>;
}

/* ----------------------------- Card ----------------------------- */

export function Card({
  title,
  icon,
  action,
  className,
  children,
}: {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "mb-4 rounded-xl border border-border bg-card text-card-foreground p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ----------------------------- Inputs ----------------------------- */

export const inputClass =
  "flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";
export const selectClass = inputClass;
export const textareaClass = inputClass;

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* ----------------------------- Badge ----------------------------- */

type Tone = "gray" | "green" | "red" | "amber" | "brand";
const TONES: Record<Tone, string> = {
  gray: "bg-muted text-muted-foreground",
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  brand: "bg-brand-100 text-brand-800 dark:bg-blue-500/15 dark:text-blue-300",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------- StatCard ----------------------------- */

export function StatCard({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  /** Makes the card a link, e.g. to a drill-down report. */
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon && <span className="text-primary">{icon}</span>}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
      >
        {body}
        <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
          View details <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </Link>
    );
  }

  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm">{body}</div>;
}

/* ----------------------------- PageHeader ----------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------- Avatar ----------------------------- */

const AVATAR_TONES = [
  "bg-brand-100 text-brand-800 dark:bg-blue-500/15 dark:text-blue-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
];

// Academic titles aren't part of someone's initials — drop them so e.g.
// "Dr. Anik Kumar Hazra" and "Prof. Anupam Bhattacharya" don't all collapse to "D"/"P".
const NAME_TITLES = new Set(["dr", "dr.", "prof", "prof.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "miss"]);

export function Avatar({ name, className }: { name: string; className?: string }) {
  // Faculty use the timetable's official initials (e.g. "SAG"/"SNG" for the
  // two Ghoshs) so look-alike names stay distinguishable.
  const faculty = FACULTY_INITIALS_BY_NAME[name];
  const words = name.split(/\s+/).filter((w) => !NAME_TITLES.has(w.toLowerCase()));
  const initials = (
    faculty ??
    (words.length >= 2
      ? (words[0][0] ?? "") + (words[words.length - 1][0] ?? "")
      : words.map((w) => w[0] ?? "").join(""))
  ).toUpperCase();
  const tone =
    AVATAR_TONES[
      [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length
    ];
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-semibold",
        initials.length > 2 ? "text-[10px]" : "text-xs",
        tone,
        className,
      )}
    >
      {initials}
    </span>
  );
}

/* ----------------------------- EmptyState ----------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
      {icon && <div className="mb-2 text-muted-foreground/50">{icon}</div>}
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ----------------------------- ProgressRing ----------------------------- */

export function ProgressRing({
  percent,
  size = 56,
}: {
  percent: number;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  const color = percent >= 75 ? "#059669" : percent >= 60 ? "#d97706" : "#dc2626";
  return (
    <div className="relative inline-flex" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-foreground">
        {percent}%
      </span>
    </div>
  );
}
