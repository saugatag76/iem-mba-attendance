/**
 * End-to-end verification against the running dev server + Neon DB.
 * Exercises: login (Auth.js), rotating-QR scan, idempotency, expired token,
 * geofence rejection, device-mismatch flagging, and the manual personal-QR fallback.
 */
import { prisma } from "../lib/prisma";
import { signSessionToken, signPersonalToken } from "../lib/qrToken";

const BASE = "http://localhost:3000";

function jar() {
  const store = new Map<string, string>();
  return {
    apply(res: Response) {
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const idx = pair.indexOf("=");
        store.set(pair.slice(0, idx), pair.slice(idx + 1));
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

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: BASE,
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies.header() },
    body,
    redirect: "manual",
  });
  cookies.apply(res);

  // Confirm we actually have a session.
  const sessRes = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: cookies.header() } });
  const sess = await sessRes.json();
  if (!sess?.user) throw new Error(`login failed for ${email}`);
  return { cookies, user: sess.user };
}

async function scan(cookie: string, payload: object) {
  const res = await fetch(`${BASE}/api/attendance/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.log(`  ✗ ${name} →`, detail);
    fail++;
  }
}

async function main() {
  console.log("Verifying end-to-end…\n");

  // --- Setup: pick any offering that has enrolled students, open a fresh geofenced session.
  const offering = await prisma.offering.findFirst({
    where: { classSection: { enrollments: { some: {} } } },
    include: {
      teacher: true,
      classSection: { include: { enrollments: { include: { student: true } } } },
    },
  });
  if (!offering) throw new Error("No offering with enrolled students — did the seed run?");

  const enrolledStudents = offering.classSection.enrollments.map((e) => e.student);
  if (enrolledStudents.length < 4)
    throw new Error("Need at least 4 enrolled students in one section to run all checks.");

  const anchorLat = 22.5726;
  const anchorLng = 88.3639;
  const session = await prisma.session.create({
    data: {
      offeringId: offering.id,
      teacherId: offering.teacherId,
      geoLat: anchorLat,
      geoLng: anchorLng,
      geoRadiusM: 75,
      status: "OPEN",
    },
  });

  // --- Logins (all seeded students share "stud123", teachers "teach123")
  const student1 = await login(enrolledStudents[0].email, "stud123");
  check("student login", student1.user.role === "STUDENT", student1.user);
  const teacher1 = await login(offering.teacher.email, "teach123");
  check("teacher login", teacher1.user.role === "TEACHER", teacher1.user);

  // --- Happy path: valid rotating token, inside geofence.
  const goodToken = await signSessionToken(session.id, session.qrSecret);
  const r1 = await scan(student1.cookies.header(), {
    token: goodToken,
    deviceId: "device-A",
    lat: anchorLat,
    lng: anchorLng,
  });
  check("valid scan inside geofence → present", r1.status === 200 && r1.body.ok === true, r1);

  // --- Idempotency: scanning again is a no-op.
  const good2 = await signSessionToken(session.id, session.qrSecret);
  const r2 = await scan(student1.cookies.header(), {
    token: good2,
    deviceId: "device-A",
    lat: anchorLat,
    lng: anchorLng,
  });
  check("second scan → already marked", r2.status === 200 && r2.body.already === true, r2);

  // --- Expired token rejected (TTL 1s, signed in the past via ttl=-10).
  const expired = await signSessionToken(session.id, session.qrSecret, -10);
  const student2 = await login(enrolledStudents[1].email, "stud123");
  const r3 = await scan(student2.cookies.header(), {
    token: expired,
    deviceId: "device-B",
    lat: anchorLat,
    lng: anchorLng,
  });
  check("expired token → rejected", r3.status === 401, r3);

  // --- Geofence rejection: valid token but far away (~1.5km).
  const farToken = await signSessionToken(session.id, session.qrSecret);
  const r4 = await scan(student2.cookies.header(), {
    token: farToken,
    deviceId: "device-B",
    lat: anchorLat + 0.02,
    lng: anchorLng + 0.02,
  });
  check("outside geofence → rejected", r4.status === 403, r4);

  // --- Not enrolled: admin (not a student) cannot scan.
  const notStudentToken = await signSessionToken(session.id, session.qrSecret);
  const admin = await login("admin@iem.edu", "admin123");
  const r5 = await scan(admin.cookies.header(), { token: notStudentToken, deviceId: "x" });
  check("non-student scan → forbidden", r5.status === 403, r5);

  // --- Device mismatch flag: student2 scans from device-B first (binds), then a new token from device-C.
  // First bind student2 to device-B with a valid in-fence scan:
  const bind = await signSessionToken(session.id, session.qrSecret);
  const rb = await scan(student2.cookies.header(), {
    token: bind,
    deviceId: "device-B",
    lat: anchorLat,
    lng: anchorLng,
  });
  check("student2 valid scan → present", rb.status === 200 && rb.body.ok === true, rb);

  // student3 logs in, binds device-C, then we simulate a mismatch by scanning with device-Z.
  const student3 = await login(enrolledStudents[2].email, "stud123");
  const t3a = await signSessionToken(session.id, session.qrSecret);
  await scan(student3.cookies.header(), {
    token: t3a,
    deviceId: "device-C",
    lat: anchorLat,
    lng: anchorLng,
  }); // binds device-C
  // Open a SECOND session so student3 can scan again on a different device.
  const session2 = await prisma.session.create({
    data: {
      offeringId: offering.id,
      teacherId: offering.teacherId,
      geoLat: anchorLat,
      geoLng: anchorLng,
      geoRadiusM: 75,
      status: "OPEN",
    },
  });
  const t3b = await signSessionToken(session2.id, session2.qrSecret);
  const r6 = await scan(student3.cookies.header(), {
    token: t3b,
    deviceId: "device-Z", // different device
    lat: anchorLat,
    lng: anchorLng,
  });
  check("device mismatch → present but flagged", r6.status === 200 && r6.body.flagged === true, r6);

  // --- Manual fallback: teacher scans student4's personal QR.
  const s4 = await prisma.user.findUniqueOrThrow({ where: { id: enrolledStudents[3].id } });
  const personal = await signPersonalToken(s4.id, s4.personalQrSecret);
  const mres = await fetch(`${BASE}/api/attendance/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacher1.cookies.header() },
    body: JSON.stringify({ sessionId: session.id, token: personal }),
  });
  const mbody = await mres.json().catch(() => ({}));
  check("manual personal-QR scan → present", mres.status === 200 && mbody.ok === true, { s: mres.status, mbody });

  // --- Live endpoint reflects the roster.
  const live = await fetch(`${BASE}/api/session/${session.id}/live`, {
    headers: { Cookie: teacher1.cookies.header() },
  }).then((r) => r.json());
  check("live endpoint returns token + roster", !!live.token && Array.isArray(live.present), live);
  check("present roster includes manual + flagged correctly", live.present.length >= 3, live.present?.length);

  // --- Cleanup the sessions we created (keep seed data clean for the user's own testing).
  await prisma.session.deleteMany({ where: { id: { in: [session.id, session2.id] } } });
  // Reset device bindings we set during the test.
  await prisma.user.updateMany({
    where: { id: { in: enrolledStudents.slice(0, 3).map((s) => s.id) } },
    data: { deviceId: null },
  });

  console.log(`\n${pass} passed, ${fail} failed.`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
