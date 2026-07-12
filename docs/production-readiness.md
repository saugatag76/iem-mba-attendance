# Production Readiness

This is a decision-support document, not an execution log — it lists what's wrong with the
*current* hosting/DB setup and what needs deciding before a real launch. Nothing here has been
implemented; it's a checklist to work through, not a record of changes made. Every claim below
was verified directly against this repo's code (file/line cited), not assumed.

**Current stack**: Vercel (tier unconfirmed in-repo, everything below assumes Hobby/free since
that's what a dev deployment defaults to) + Neon free-tier Postgres + NextAuth v5 (JWT sessions)
+ Prisma. No CI/CD, no monitoring, no test suite.

---

## 1. Vercel flaws

- **Hobby plan ToS**: Vercel's Hobby tier is licensed for personal, non-commercial projects.
  A college department running real student attendance tracking is organizational use and
  needs at least a **Pro** plan — worth confirming/upgrading before launch regardless of the
  technical issues below.
- **No cron capability configured** — no `vercel.json`, no `/api/cron*` route anywhere in the
  repo. The "auto-close expired sessions" gap (`docs/handoff.md` §16) has nowhere to run even
  if built — Hobby also caps cron to once/day vs. unlimited on Pro, so this doubles as a
  reason to upgrade.
- **Serverless function timeout risk**: Hobby's default function timeout is 10s. `app/admin/import/actions.ts`'s
  `importStudentsPreviewed` runs a **sequential `for` loop**, 2–3 awaited DB round-trips per
  CSV row, inside a single Server Action invocation. Fine at the scale tested this session, but
  a 500+ row import against a cold/throttled Neon connection is a real timeout risk in
  production. `app/api/admin/students/export/xlsx/route.ts` builds the whole workbook
  synchronously in memory — CPU-bound but low risk at current data volume.
- No `export const runtime = "edge"` / `maxDuration` overrides exist anywhere — every route
  runs on Vercel's default Node.js serverless runtime with whatever timeout the plan grants.

## 2. Neon free-tier flaws

- ~0.5GB storage cap, autosuspend after inactivity (cold-start latency on the first request
  after idle), and a monthly compute-hour cap — all standard free-tier limits, not configurable.
- **No backup or point-in-time recovery on the free tier.** Confirmed nothing in this repo
  implements backups at all — `docs/handoff.md` §14's backup script assumes a self-hosted
  Postgres box with SSH + cron + local disk, which doesn't match a Neon deployment and won't
  run anywhere as-is. This was the reason `scripts/wipe-test-data.ts` (used to clean this DB
  for launch) writes its own JSON export before deleting anything — there was no other safety
  net available.
- `prisma/schema.prisma`'s datasource block only has `url = env("DATABASE_URL")` — no
  `directUrl` / separate pooled-vs-direct connection split, which Prisma recommends for
  serverless + PgBouncer setups.
- No retry/backoff or timeout handling anywhere in `lib/` for a cold-start connection failure —
  a Neon wake-up hiccup would currently surface as a raw unhandled error to whoever hits it.

## 3. Security gaps
(Cross-checked against `docs/handoff.md` §16 — confirmed still accurate as of this pass.)

- **No rate limiting** on `/api/attendance/scan` or the credentials login — both are
  brute-forceable. No `middleware.ts` file exists in the repo at all.
- **Sessions aren't invalidated on password change** — JWTs default to NextAuth's 30-day
  `maxAge` (not explicitly set in `auth.ts`), so after an admin resets someone's password via
  the new Reset Password feature, their old session keeps working until it naturally expires.
- **No CSP or security headers** — no `headers()` block in `next.config.ts`, so no
  `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, etc.
- No explicit cookie hardening (`secure`/`sameSite`) configured — relying entirely on
  NextAuth's defaults.

## 4. Observability gaps

- No error monitoring/APM (no Sentry or equivalent in `package.json`).
- No `/api/health` route, no uptime monitoring set up.
- Near-zero structured logging — almost no `console.*` usage in `app/`/`lib/`, and only 5 of
  the 15 API routes have any `try/catch` at all. A production incident today would be
  diagnosed almost entirely from Vercel's raw function logs.

## 5. CI/CD gap

- No `.github/workflows` or any other CI config. No `test` script in `package.json`, no test
  framework installed. Nothing runs automatically before a merge or deploy besides Vercel's
  own build step (`prisma generate && next build`).

## 6. Small doc fix made alongside this checklist

`docs/handoff.md` §6 previously listed `NEXTAUTH_SECRET`/`NEXTAUTH_URL` as the env var names,
but the actual code (`auth.ts`, NextAuth v5 convention) and `.env.example` use
`AUTH_SECRET`/`AUTH_URL` — corrected in that file so this checklist doesn't repeat the same
stale names.

---

## Checklist

### Must-fix before a real launch
- [ ] Confirm/upgrade Vercel plan (Hobby's ToS doesn't cover organizational use; also unlocks cron)
- [ ] Set up a real backup strategy for the Postgres data — Neon paid tier's PITR, or a
      scheduled `pg_dump` to external storage; the free tier currently has **zero** recovery
      path if the database is lost or corrupted
- [ ] Add rate limiting to `/api/attendance/scan` and the credentials login route
- [ ] Add basic security headers (`X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, CSP) via `next.config.ts` `headers()`
- [ ] Fix the bulk-import timeout risk in `app/admin/import/actions.ts` (batch the DB writes
      instead of a per-row sequential loop, or move it off the request path)

### Should fix soon after launch
- [ ] Session invalidation on password change (store `passwordChangedAt`, check it in the JWT callback)
- [ ] Add `/api/health` + an uptime monitor (UptimeRobot or similar, free tier is fine)
- [ ] Add error monitoring (Sentry free tier)
- [ ] Add a cron job (once Vercel plan supports it) to proactively auto-close expired sessions
- [ ] Add `directUrl` / confirm PgBouncer pooled connection string is actually set in Vercel's
      env vars (can't verify from the repo alone — check the deployed value)

### Nice to have
- [ ] Basic CI (lint + typecheck + build on every PR, even without a test suite yet)
- [ ] A minimal test suite for the auth/attendance-marking critical path
- [ ] Structured logging in API routes instead of silent failures

---

## Hosting/DB options (informational — not a recommendation to act on unilaterally)

These are tradeoffs to decide on, not a migration this document performs:

- **Stay on Vercel, upgrade to Pro** — least migration effort, unlocks cron + higher timeouts;
  still leaves you on Neon for the DB unless changed separately.
- **Neon paid tier** (Launch/Scale) — adds PITR backups, more storage/compute, no autosuspend
  on higher tiers; stays in the same Vercel+Neon architecture, smallest change.
- **Self-hosted VPS + managed Postgres** (e.g. a small droplet/VM + Neon or RDS/Supabase) —
  more operational overhead (you own uptime, deploys, scaling) but full control and often
  cheaper at steady-state for a single department's traffic.
- **Alternative all-in-one platforms** (Railway, Render, etc.) — similar convenience to Vercel,
  worth a look if Vercel Pro pricing or limits don't fit.

The right choice depends on budget and who's available to operate it long-term — worth a short
explicit decision rather than defaulting to whichever is fastest to set up.
