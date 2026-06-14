// Verifies the scan-location feature: creates a session with one in-range and one
// out-of-range scan, then loads the session report page and checks it renders the map
// + distances. Cleans up afterwards.
import { prisma } from "../lib/prisma";

const BASE = "http://localhost:3000";

function jar() {
  const store = new Map<string, string>();
  return {
    apply(res: Response) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        store.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
    header() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function login(email: string, password: string) {
  const cookies = jar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  cookies.apply(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies.header() },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: BASE }),
    redirect: "manual",
  });
  cookies.apply(res);
  return cookies;
}

async function main() {
  const offering = await prisma.offering.findFirst({
    include: {
      teacher: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
    },
  });
  if (!offering || offering.classSection.enrollments.length < 2)
    throw new Error("Need an offering with >=2 enrolled students.");

  const anchorLat = 22.5726;
  const anchorLng = 88.3639;
  const session = await prisma.session.create({
    data: {
      offeringId: offering.id,
      teacherId: offering.teacherId,
      geoLat: anchorLat,
      geoLng: anchorLng,
      geoRadiusM: 75,
      status: "CLOSED",
    },
  });
  const [s1, s2] = offering.classSection.enrollments;
  // s1 in range (~same point), s2 far (~2.5km away)
  await prisma.attendanceRecord.create({
    data: { sessionId: session.id, studentId: s1.studentId, geoLat: anchorLat, geoLng: anchorLng },
  });
  await prisma.attendanceRecord.create({
    data: {
      sessionId: session.id,
      studentId: s2.studentId,
      geoLat: anchorLat + 0.025,
      geoLng: anchorLng + 0.025,
      flagged: true,
      flagReason: "test",
    },
  });

  const cookies = await login(offering.teacher.email, "teach123");
  const html = await fetch(`${BASE}/reports/session/${session.id}`, {
    headers: { Cookie: cookies.header() },
  }).then((r) => r.text());

  const checks: [string, boolean][] = [
    ["page loaded (has student name)", html.includes(s1.student.name)],
    ["map section rendered", html.includes("Scan locations")],
    ["distance shown (meters)", /\d+\s*m/.test(html)],
    ["out-of-range marker", html.includes("(outside)")],
    ["google maps link", html.includes("https://www.google.com/maps?q=")],
  ];
  let fail = 0;
  for (const [name, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
    if (!ok) fail++;
  }

  await prisma.session.delete({ where: { id: session.id } });
  console.log(`\n${checks.length - fail}/${checks.length} passed.`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
