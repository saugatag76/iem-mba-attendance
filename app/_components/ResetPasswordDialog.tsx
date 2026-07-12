"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetPassword } from "@/app/admin/actions";
import { DEFAULT_STUDENT_PASSWORD } from "@/lib/studentDefaults";

export function ResetPasswordDialog({
  userId,
  userName,
  role,
  redirectTo,
}: {
  userId: string;
  userName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent"
      >
        <KeyRound className="h-3 w-3" /> Reset password
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset password — {userName}</DialogTitle>
          </DialogHeader>
          <form action={resetPassword} className="space-y-4">
            <input type="hidden" name="id" value={userId} />
            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
              <input
                name="newPassword"
                required
                minLength={6}
                defaultValue={role === "STUDENT" ? DEFAULT_STUDENT_PASSWORD : ""}
                placeholder="At least 6 characters"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              {role === "STUDENT" && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The student will be required to set their own password on next login before they can mark attendance.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Reset password
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
