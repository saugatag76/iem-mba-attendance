"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutGrid,
  FileBarChart,
  CalendarDays,
  Layers,
  Users,
  Link2,
  Upload,
  LogOut,
  Menu,
  X,
  Radio,
  Search,
  ArrowLeftRight,
  MapPin,
  KeyRound,
  CalendarRange,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { Avatar, cn } from "./ui";
import { doSignOut } from "./auth-actions";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPalette } from "./CommandPalette";
import { ToastListener } from "./ToastListener";
import { PageTransition } from "./motion";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV: Record<Role, { section: string; items: Item[] }[]> = {
  ADMIN: [
    {
      section: "Dashboards",
      items: [
        { href: "/admin", label: "Overview", icon: LayoutGrid },
        { href: "/reports", label: "Reports", icon: FileBarChart },
      ],
    },
    {
      section: "Manage",
      items: [
        { href: "/admin/academics", label: "Academics", icon: Layers },
        { href: "/admin/people", label: "People", icon: Users },
        { href: "/admin/offerings", label: "Offerings", icon: Link2 },
        { href: "/admin/routine", label: "Routine", icon: CalendarDays },
        { href: "/admin/substitutions", label: "Substitutions", icon: ArrowLeftRight },
        { href: "/events", label: "Events", icon: CalendarRange },
        { href: "/admin/import", label: "Import", icon: Upload },
        { href: "/admin/location-test", label: "Location test", icon: MapPin },
      ],
    },
  ],
  TEACHER: [
    {
      section: "Dashboards",
      items: [
        { href: "/teacher", label: "My Day", icon: LayoutGrid },
        { href: "/teacher/timetable", label: "My Timetable", icon: CalendarDays },
        { href: "/reports", label: "Reports", icon: FileBarChart },
        { href: "/teacher/substitutions", label: "Substitutions", icon: ArrowLeftRight },
        { href: "/events", label: "Events", icon: CalendarRange },
      ],
    },
  ],
  STUDENT: [
    {
      section: "Dashboards",
      items: [
        { href: "/student", label: "Overview", icon: LayoutGrid },
        { href: "/student/scan", label: "Mark attendance", icon: KeyRound },
        { href: "/student/events", label: "Events", icon: CalendarRange },
        { href: "/student/timetable", label: "Timetable", icon: CalendarDays },
      ],
    },
  ],
};

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administrator", TEACHER: "Faculty", STUDENT: "Student" };

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/teacher" || href === "/student") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({
  role,
  name,
  children,
  liveSession,
  pendingCounts,
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
  liveSession?: { id: string; label: string } | null;
  pendingCounts?: { substitutions?: number };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const groups = NAV[role] ?? [];
  const onLiveSession = liveSession && pathname === `/teacher/session/${liveSession.id}`;

  return (
    <div className="min-h-screen lg:flex">
      <Suspense fallback={null}>
        <ToastListener />
      </Suspense>
      <CommandPalette groups={groups} open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground/80 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">MBA Attendance</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40">IEM · MBA Dept</div>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto text-sidebar-foreground/60 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.section} className="mb-6">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {g.section}
              </div>
              <ul className="space-y-1">
                {g.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          active
                            ? "bg-primary/10 text-sidebar-primary font-semibold"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        <span className="flex-1">{it.label}</span>
                        {it.href.endsWith("/substitutions") && (pendingCounts?.substitutions ?? 0) > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {pendingCounts!.substitutions}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <Avatar name={name} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{name}</div>
              <div className="text-[11px] text-sidebar-foreground/40">{ROLE_LABEL[role]}</div>
            </div>
          </div>
          <Link
            href="/settings/change-password"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <KeyRound className="h-4 w-4" /> Change password
          </Link>
          <form action={doSignOut}>
            <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          <button onClick={() => setOpen(true)} className="text-muted-foreground lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>

          {liveSession && !onLiveSession && (
            <Link
              href={`/teacher/session/${liveSession.id}`}
              className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span className="hidden sm:inline">Live:</span>
              <span className="max-w-[40vw] truncate sm:max-w-[220px]">{liveSession.label}</span>
              <span className="hidden font-semibold sm:inline">Go to session →</span>
            </Link>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Search…</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[10px] md:inline">⌘K</kbd>
          </button>

          <ThemeToggle />

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium leading-tight text-foreground">{name}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{ROLE_LABEL[role]}</div>
            </div>
            <Avatar name={name} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <PageTransition key={pathname}>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
