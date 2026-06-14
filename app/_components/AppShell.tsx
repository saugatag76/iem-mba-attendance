"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutGrid,
  FileBarChart,
  BookOpen,
  QrCode,
  CalendarDays,
  Layers,
  Users,
  Link2,
  Upload,
  LogOut,
  Menu,
  X,
  Radio,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { Avatar, cn } from "./ui";
import { doSignOut } from "./auth-actions";

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
        { href: "/admin/import", label: "Import", icon: Upload },
      ],
    },
  ],
  TEACHER: [
    {
      section: "Dashboards",
      items: [
        { href: "/teacher", label: "My Day", icon: LayoutGrid },
        { href: "/reports", label: "Reports", icon: FileBarChart },
      ],
    },
  ],
  STUDENT: [
    {
      section: "Dashboards",
      items: [
        { href: "/student", label: "Overview", icon: LayoutGrid },
        { href: "/student/scan", label: "Scan", icon: QrCode },
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
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
  liveSession?: { id: string; label: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = NAV[role] ?? [];
  const onLiveSession = liveSession && pathname === `/teacher/session/${liveSession.id}`;

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-slate-300 transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">MBA Attendance</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">IEM · MBA Dept</div>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto text-slate-400 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.section} className="mb-6">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
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
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          active
                            ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20"
                            : "text-slate-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        {it.label}
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
              <div className="text-[11px] text-slate-500">{ROLE_LABEL[role]}</div>
            </div>
          </div>
          <form action={doSignOut}>
            <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white">
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
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md">
          <button onClick={() => setOpen(true)} className="text-slate-600 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          {liveSession && !onLiveSession && (
            <Link
              href={`/teacher/session/${liveSession.id}`}
              className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-200 transition hover:bg-green-100"
            >
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              <span className="hidden sm:inline">Live:</span>
              <span className="max-w-[40vw] truncate sm:max-w-[220px]">{liveSession.label}</span>
              <span className="hidden font-semibold sm:inline">Go to session →</span>
            </Link>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium leading-tight text-slate-800">{name}</div>
              <div className="text-[11px] leading-tight text-slate-400">{ROLE_LABEL[role]}</div>
            </div>
            <Avatar name={name} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
