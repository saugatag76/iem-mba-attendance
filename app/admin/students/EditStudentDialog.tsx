"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateStudent } from "./actions";

type Section = { id: string; name: string };

export function EditStudentDialog({
  student,
  sections,
}: {
  student: { id: string; name: string; phone: string | null; sectionId: string | null };
  sections: Section[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
          </DialogHeader>
          <form action={updateStudent} className="space-y-4">
            <input type="hidden" name="id" value={student.id} />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
              <input
                name="name"
                required
                defaultValue={student.name}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Phone number</label>
              <input
                name="phone"
                required
                defaultValue={student.phone ?? ""}
                placeholder="9876543210"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Section</label>
              <select
                name="sectionId"
                required
                defaultValue={student.sectionId ?? ""}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Select section…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-3">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Save changes
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
