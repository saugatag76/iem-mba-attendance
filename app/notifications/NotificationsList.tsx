"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationsList({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div>
      {unreadCount > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); if (n.link) router.push(n.link); }}
                className={cn(
                  "flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-accent",
                  !n.read && "bg-primary/5 dark:bg-primary/8",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  {!n.read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                  <span className="font-medium text-foreground">{n.title}</span>
                  <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
