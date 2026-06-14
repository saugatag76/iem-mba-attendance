import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import type { Weekday } from "@prisma/client";
import type { ScheduleRow } from "@/lib/schedule";
import { WEEKDAYS, WEEKDAY_LABEL } from "@/lib/schedule";
import { Avatar, Badge, EmptyState } from "./ui";

export function ClassRow({
  row,
  showSection = false,
  showTeacher = false,
  children,
}: {
  row: ScheduleRow;
  showSection?: boolean;
  showTeacher?: boolean;
  children?: ReactNode;
}) {
  const subject = row.offering?.subject;
  const title = subject ? subject.name : row.rawLabel;

  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="w-14 flex-shrink-0 text-center">
        <div className="text-xs font-semibold tabular-nums text-slate-700">{row.startTime}</div>
        <div className="text-[10px] tabular-nums text-slate-400">{row.endTime}</div>
      </div>
      <div className="h-9 w-px flex-shrink-0 bg-slate-200" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-800">{title}</span>
          {subject && <span className="text-xs text-slate-400">{subject.code}</span>}
          {row.subgroup && <Badge tone="gray">{row.subgroup}</Badge>}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          {showSection && row.offering && <span>{row.offering.classSection.name}</span>}
          {showTeacher && row.offering && (
            <span className="flex items-center gap-1">
              <Avatar name={row.offering.teacher.name} className="h-5 w-5 text-[9px]" />
              {row.offering.teacher.name}
            </span>
          )}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </li>
  );
}

export function WeeklyView({ byDay }: { byDay: Record<Weekday, ScheduleRow[]> }) {
  const hasAny = WEEKDAYS.some((d) => byDay[d].length > 0);
  if (!hasAny) {
    return <EmptyState icon={<Clock className="h-8 w-8" />} title="No classes scheduled" />;
  }
  return (
    <div className="space-y-4">
      {WEEKDAYS.map((d) =>
        byDay[d].length === 0 ? null : (
          <div key={d} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">
              {WEEKDAY_LABEL[d]}
            </div>
            <ul className="divide-y divide-slate-100 px-4">
              {byDay[d].map((r) => (
                <ClassRow key={r.id} row={r} showTeacher />
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
