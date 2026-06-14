import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { studentSubjectStats } from "@/lib/attendance";
import { signPersonalToken } from "@/lib/qrToken";
import { Card, Badge } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function StudentHome() {
  const user = await requireRole("STUDENT", "ADMIN");

  const [me, stats] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    studentSubjectStats(user.id),
  ]);

  const personalQr = me
    ? await QRCode.toDataURL(await signPersonalToken(me.id, me.personalQrSecret), {
        width: 180,
        margin: 1,
      })
    : "";

  return (
    <div>
      <Link
        href="/student/scan"
        className="mb-4 block rounded-xl bg-gray-900 px-4 py-4 text-center text-base font-semibold text-white active:scale-[0.99]"
      >
        Scan attendance QR
      </Link>

      <Card title="Your attendance">
        {stats.length === 0 && <p className="text-sm text-gray-500">No subjects yet.</p>}
        <ul className="space-y-2">
          {stats.map((s) => (
            <li key={s.offeringId} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {s.subjectCode} · {s.subjectName}
                </p>
                <p className="text-xs text-gray-500">
                  {s.attended}/{s.totalSessions} classes
                </p>
              </div>
              <Badge tone={s.percent >= 75 ? "green" : s.percent >= 60 ? "amber" : "red"}>
                {s.percent}%
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Your personal QR (digital ID)">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={personalQr} alt="Personal QR" className="h-36 w-36" />
          <p className="text-xs text-gray-500">
            Show this to your teacher if your camera fails — they can scan it to mark you present.
          </p>
        </div>
      </Card>
    </div>
  );
}
