"use client";

import { useRef } from "react";
import type { reassignOfferingTeacher } from "../actions";

export function ReassignTeacherSelect({
  offeringId,
  currentTeacherId,
  teachers,
  action,
}: {
  offeringId: string;
  currentTeacherId: string;
  teachers: { id: string; name: string }[];
  action: typeof reassignOfferingTeacher;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="id" value={offeringId} />
      <select
        name="teacherId"
        defaultValue={currentTeacherId}
        onChange={() => formRef.current?.requestSubmit()}
        className="max-w-[160px] truncate rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </form>
  );
}
