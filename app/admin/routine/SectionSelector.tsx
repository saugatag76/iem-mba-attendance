"use client";

import { useRouter } from "next/navigation";

export function SectionSelector({
  sections,
  activeId,
}: {
  sections: { id: string; name: string }[];
  activeId: string | null;
}) {
  const router = useRouter();
  return (
    <select
      value={activeId ?? ""}
      onChange={(e) => router.push(`/admin/routine?section=${e.target.value}`)}
      className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      aria-label="Select class section"
    >
      {sections.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
