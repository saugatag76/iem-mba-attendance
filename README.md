<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/iem-logo-ondark.webp">
  <img alt="Institute of Engineering & Management" src="public/iem-logo-onlight.webp" width="280">
</picture>

# QR Attendance Tracker

Day-to-day, class-wise, per-subject attendance via **rotating QR codes**, with strong
anti-proxy protection. Mobile-responsive website — no app install.

- **Teacher** opens a class session → screen shows a QR that **rotates every 12s**.
- **Student** logs in on their phone browser, scans the QR → marked present.
- **Anti-proxy:** short-lived signed token + enrollment check + GPS geofence + one-device-per-account.
- **Fallback:** each student has a permanent **personal QR** (digital ID); the teacher can scan it if the student's camera fails.
- **Reports:** per-subject attendance %, per-session register, defaulter lists, CSV export.

## Tech stack

Next.js (App Router, TS) · Tailwind CSS v4 · PostgreSQL + Prisma · Auth.js (NextAuth v5) ·
`jose` (signed QR tokens) · `qrcode` + `html5-qrcode` · Vercel + managed Postgres.

## Setup

1. **Install deps** (done): `npm install`
2. **Database** — set `DATABASE_URL` in `.env` to a PostgreSQL instance. Easiest is
   [Neon](https://neon.tech) (free, no install): create a project, copy the connection
   string. Or use a local Postgres.
3. **Migrate + seed:**
   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```
4. **Run:** `npm run dev` → http://localhost:3000

### Seeded logins (MBA department)

- **Admin / Teacher** log in with their `@iem.edu.in` email + password.
- **Student** logs in with their **phone number** (Year 1) or **enrollment number** (Year 2) + password.
- Default passwords are set in `lib/studentDefaults.ts` (students) and `prisma/seed.ts` (admin/teacher) — not published here. Ask the system admin, or use **Reset password** in the admin People/Students page.

Seeded structure: **MBA** dept · trimesters (Sem 1–6) · Year 1 sections A–D (all-common
subjects) · Year 2 streams Finance ×2 / HR ×1 / Tech-Mgmt ×1 + a shared **Year 2 — Common
(Marketing)** group. Subjects are **dummy placeholders** (MB101…, FN201…, HR201…, TM201…,
MK201…) to be replaced with the real list. Offerings/students are seeded for **Year 1 Sec A**
and **Year 2 Finance A** so both the common and stream+Marketing flows are testable.

## How to demo

1. Sign in as **teacher1**, click **Open session** on a class (allow location for the geofence).
2. The session page shows the rotating QR.
3. On a phone, sign in as **student1**, tap **Scan attendance QR**, scan the screen → "Marked present!"
4. Watch the teacher's live present count increment.
5. **Reports** (top-right link / `/reports`) → per-subject % and CSV export.

> Camera and geolocation require a **secure context**. `localhost` is treated as secure;
> on a phone over LAN you need HTTPS (use the Vercel deployment, or a tunnel like `ngrok`).

## Anti-proxy notes

- Rotating QR (12s TTL) makes a shared screenshot useless seconds later.
- Geofence is enforced only when the teacher opened the session with location enabled.
- Device binding ties an account to its first device; later mismatches are **flagged** (⚑)
  for review rather than hard-blocked, since browsers can't truly fingerprint hardware.

## Deploy (Vercel)

1. Push to GitHub, import into Vercel.
2. Set env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (your https domain).
3. Build runs `prisma generate && next build`. Run `prisma migrate deploy` against the prod DB.
