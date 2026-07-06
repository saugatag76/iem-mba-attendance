"use client";

import { useRouter } from "next/navigation";

type SlotOption = {
  id: string;
  label: string;
};

export function ClassSelector({ slots }: { slots: SlotOption[] }) {
  const router = useRouter();
  return (
    <select
      required
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) router.push(`/teacher/substitutions/new?slotId=${e.target.value}`);
      }}
      className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      <option value="" disabled>Select a class…</option>
      {slots.map((s) => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
}
