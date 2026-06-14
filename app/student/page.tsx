import Link from "next/link";
import QRCode from "qrcode";
import { QrCode, IdCard, BookOpen, CalendarClock, CalendarDays, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { studentSubjectStats } from "@/lib/attendance";
import { studentClassesForDay, todayWeekday, WEEKDAY_LABEL } from "@/lib/schedule";
import { signPersonalToken } from "@/lib/qrToken";
import { Card, Badge, ProgressRing, EmptyState } from "@/app/_components/ui";
import { ClassRow } from "@/app/_components/schedule-ui";

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

  const overall =
    stats.length > 0
      ? Math.round(stats.reduce((a, s) => a + s.percent, 0) / stats.length)
      : 0;

  return (
    <div>
      {/* Scan CTA */}
      <Link
        href="/student/scan"
        className="mb-5 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white shadow-md shadow-brand-900/20 transition active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
          <QrCode className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <p className="text-base font-semibold">Scan attendance QR</p>
          <p className="text-sm text-white/70">Point your camera at the teacher&apos;s screen</p>
        </div>
      </Link>

      <Card
        title={day ? `Today · ${WEEKDAY_LABEL[day]}` : "Today"}
        icon={<CalendarClock className="h-4 w-4" />}
        action={
          <Link
            href="/student/timetable"
            className="flex items-center gap-0.5 text-xs font-medium text-brand-700 hover:text-brand-800"
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
          <ul className="divide-y divide-slate-100">
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
          stats.length > 0 ? (
            <Badge tone={overall >= 75 ? "green" : overall >= 60 ? "amber" : "red"}>
              {overall}% overall
            </Badge>
          ) : undefined
        }
      >
        {stats.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No subjects yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {stats.map((s) => (
              <li key={s.offeringId} className="flex items-center gap-3 py-2.5">
                <ProgressRing percent={s.percent} size={48} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{s.subjectName}</p>
                  <p className="text-xs text-slate-500">
                    {s.subjectCode} · {s.attended}/{s.totalSessions} classes attended
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Your personal QR (digital ID)" icon={<IdCard className="h-4 w-4" />}>
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-slate-100 bg-white p-2 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={personalQr} alt="Personal QR" className="h-32 w-32" />
          </div>
          <p className="text-sm text-slate-500">
            Show this to your teacher if your camera fails — they can scan it to mark you present.
          </p>
        </div>
      </Card>
    </div>
  );
}
