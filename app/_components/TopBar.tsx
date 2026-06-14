"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import type { Role } from "@prisma/client";
import { Avatar, cn } from "./ui";
import { doSignOut } from "./auth-actions";

const NAV: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/admin", label: "Manage" },
    { href: "/reports", label: "Reports" },
  ],
  TEACHER: [
    { href: "/teacher", label: "Classes" },
    { href: "/reports", label: "Reports" },
  ],
  STUDENT: [
    { href: "/student", label: "Home" },
    { href: "/student/scan", label: "Scan" },
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  TEACHER: "Faculty",
  STUDENT: "Student",
};

export function TopBar({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();
  const links = NAV[role] ?? [];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight text-slate-900 sm:block">
            MBA Attendance
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === pathname ||
              (l.href !== "/student" && l.href !== "/admin" && l.href !== "/teacher"
                ? pathname.startsWith(l.href)
                : pathname === l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium leading-tight text-slate-800">{name}</div>
            <div className="text-[11px] leading-tight text-slate-400">{ROLE_LABEL[role]}</div>
          </div>
          <Avatar name={name} />
          <form action={doSignOut}>
            <button
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
