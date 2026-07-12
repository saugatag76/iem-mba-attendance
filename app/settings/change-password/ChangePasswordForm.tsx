"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { changePassword } from "./actions";

function PasswordInput({ name, placeholder }: { name: string; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        required
        minLength={6}
        className="w-full rounded-md border border-input bg-card px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function ChangePasswordForm({ forced }: { forced?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get("newPassword") !== fd.get("confirmPassword")) {
      setResult({ ok: false, message: "New passwords don't match." });
      return;
    }
    startTransition(async () => {
      const res = await changePassword(fd);
      setResult(res);
      if (res.ok) {
        if (forced) {
          setTimeout(() => {
            router.push("/student");
            router.refresh();
          }, 900);
        } else {
          form.reset();
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Current password</label>
        <PasswordInput name="currentPassword" placeholder="Your current password" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
        <PasswordInput name="newPassword" placeholder="At least 6 characters" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Confirm new password</label>
        <PasswordInput name="confirmPassword" placeholder="Repeat new password" />
      </div>

      {result && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          result.ok
            ? "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
            : "border-red-500/30 bg-red-500/8 text-red-600 dark:text-red-400"
        }`}>
          {result.ok
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            : <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </button>
    </form>
  );
}
