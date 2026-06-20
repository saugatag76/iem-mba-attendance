import Link from "next/link";
import QRCode from "qrcode";
import { QrCode, IdCard, BookOpen, CalendarClock, CalendarDays, ChevronRight, AlertTriangle } from "lucide-react";
import type { SubjectStat } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { studentSubjectStats } from "@/lib/attendance";
import { studentClassesForDay, todayWeekday, WEEKDAY_LABEL } from "@/lib/schedule";
import { signPersonalToken } from "@/lib/qrToken";
import { Card, Badge, ProgressRing, EmptyState } from "@/app/_components/ui";
import { ClassRow } from "@/app/_components/schedule-ui";
import { DonutChart, Legend } from "@/app/_components/charts";
import { ShowMore } from "@/app/_components/ShowMore";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await requireRole("STUDENT", "ADMIN");
  const day = todayWeekday();

  const [me, stats, today] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    studentSubjectStats(user.id),
    studentClassesForDay(user.id, day),
  ]);

  const personalQr = me
    ? await QRCode.toDataURL(await signPersonalToken(me.id, me.personalQrSecret), {
        width: 220,
        margin: 1,
      })
    : "";

  // Subjects with no sessions held yet have no attendance to report — keep them
  // out of the overall %, the below-75% alert, and the risk-sorted list.
  const started = stats.filter((s) => s.totalSessions > 0);
  const notStarted = stats.filter((s) => s.totalSessions === 0);
  const overall =
    started.length > 0
      ? Math.round(started.reduce((a, s) => a + s.percent, 0) / started.length)
      : 0;
  const attended = started.reduce((a, s) => a + s.attended, 0);
  const totalClasses = started.reduce((a, s) => a + s.totalSessions, 0);
  const attendanceDonut = [
    { name: "Present", value: attended, color: "#f97316" },
    { name: "Missed", value: Math.max(0, totalClasses - attended), color: "#f43f5e" },
  ];
  // Lowest attendance first to surface risk; flag anything below the 75% threshold.
  const sortedStats = [...started].sort((a, b) => a.percent - b.percent);
  const below75 = sortedStats.filter((s) => s.percent < 75);

  return (
    <div>
      {/* Scan CTA */}
      <Link
        href="/student/scan"
        className="group mb-4 flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-white shadow-sm shadow-primary/20 transition active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-card/15">
          <QrCode className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Scan attendance QR</p>
          <p className="text-xs text-white/80">Point your camera at the teacher&apos;s screen</p>
        </div>
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-white/70 transition group-hover:translate-x-0.5" />
      </Link>

      <Card title="Attendance overview" className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
          <div>
            <DonutChart data={attendanceDonut} centerValue={`${overall}%`} centerLabel="overall" />
            <Legend data={attendanceDonut} />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-1">
            <Stat label="Subjects" value={started.length} />
            <Stat label="Sessions held" value={totalClasses} />
            <Stat label="Classes attended" value={attended} />
          </div>
        </div>
      </Card>

      <Card
        title={day ? `Today · ${WEEKDAY_LABEL[day]}` : "Today"}
        icon={<CalendarClock className="h-4 w-4" />}
        action={
          <Link
            href="/student/timetable"
            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary"
          >
            Full timetable <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {today.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={day ? "No classes today" : "No classes on weekends"}
          />
        ) : (
          <ul className="divide-y divide-border">
            {today.map((r) => (
              <ClassRow key={r.id} row={r} showTeacher />
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Your attendance"
        icon={<BookOpen className="h-4 w-4" />}
        action={
          started.length > 0 ? (
            <Badge tone={overall >= 75 ? "green" : overall >= 60 ? "amber" : "red"}>{overall}% overall</Badge>
          ) : undefined
        }
      >
        {stats.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No subjects yet" />
        ) : (
          <>
            {below75.length > 0 && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-sm text-red-600 dark:border-red-500/25 dark:bg-red-500/12 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {below75.length} subject{below75.length > 1 ? "s" : ""} below 75% — shown first.
              </div>
            )}
            {started.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No sessions held yet" />
            ) : (
              <ShowMore
                items={sortedStats.map((s) => <SubjectRow key={s.offeringId} s={s} />)}
                cap={6}
                itemName="subject"
              />
            )}
            {notStarted.length > 0 && (
              <details className="group mt-2 border-t border-border pt-2">
                <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-muted-foreground">
                  {notStarted.length} subject{notStarted.length > 1 ? "s" : ""} with no sessions yet
                </summary>
                <ul className="mt-1 divide-y divide-border">
                  {notStarted.map((s) => (
                    <li key={s.offeringId} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.subjectName}</p>
                        <p className="text-xs text-muted-foreground">{s.subjectCode}</p>
                      </div>
                      <Badge tone="gray">Not started</Badge>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </Card>

      <Card title="Your personal QR (digital ID)" icon={<IdCard className="h-4 w-4" />}>
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-border bg-card p-2 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={personalQr} alt="Personal QR" className="h-32 w-32" />
          </div>
          <p className="text-sm text-muted-foreground">
            Show this to your teacher if your camera fails — they can scan it to mark you present.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5 text-center sm:text-left">
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SubjectRow({ s }: { s: SubjectStat }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <ProgressRing percent={s.percent} size={48} />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{s.subjectName}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {s.subjectCode} · {s.attended}/{s.totalSessions} classes attended
        </p>
      </div>
    </li>
  );
}
