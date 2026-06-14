import Link from "next/link";
import { signOut } from "@/auth";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
      <Link href="/" className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{title}</span>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </Link>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 active:scale-[0.98]">
          Sign out
        </button>
      </form>
    </header>
  );
}
