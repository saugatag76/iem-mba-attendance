# MBA Attendance Tracker — Handoff Documentation

> **Institution:** IEM · MBA Department  
> **Target audience:** IT team taking over operations, incoming developers  
> **Scale:** Medium — 500–2,000 students, 50–100 teachers, 10 class sections  
> **Last updated:** June 2026  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Feature Inventory](#4-feature-inventory)
5. [Data Model](#5-data-model)
6. [Environment Variables](#6-environment-variables)
7. [Local Development Setup](#7-local-development-setup)
8. [Current Deployment (Vercel + Neon Free)](#8-current-deployment-vercel--neon-free)
9. [Production Readiness — Gap Analysis](#9-production-readiness--gap-analysis)
10. [Recommended Production Architecture](#10-recommended-production-architecture)
11. [Database — Self-Hosted Postgres on VPS](#11-database--self-hosted-postgres-on-vps)
12. [Security Hardening Checklist](#12-security-hardening-checklist)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Backup & Recovery](#14-backup--recovery)
15. [Runbook — IT Operations](#15-runbook--it-operations)
16. [Known Gaps & Technical Debt](#16-known-gaps--technical-debt)
17. [Timetable Data Pipeline](#17-timetable-data-pipeline)
18. [Key Decisions Log](#18-key-decisions-log)

---

## 1. System Overview

A **QR-based attendance management platform** for IEM's MBA Department. Replaces paper registers and manual attendance sheets with a real-time digital system.

### Core flows

```
Teacher opens session → QR displayed (rotates every 12s)
Student scans QR on phone → GPS verified → marked present
Teacher closes session → reports auto-generated
Admin monitors everything → exports CSV
```

### User roles

| Role | Count (approx.) | Primary function |
|------|----------------|-----------------|
| ADMIN | 1–3 | Full system management, reports, approvals |
| TEACHER | ~27 | Open sessions, view attendance, substitutions, events |
| STUDENT | ~500–2000 | Scan QR, view own attendance, scan events |

---

## 2. Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 15.1.4 | Full-stack React framework (App Router) |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5.7.3 | Type safety |
| **Tailwind CSS** | 4.0.0 | Utility-first CSS (CSS-based `@theme` config — no JS config file) |
| **shadcn/ui** | latest | Component library built on Radix UI primitives |
| **Framer Motion** | v11+ | Page transitions and micro-animations |
| **Radix UI** | various | Headless accessible components (via shadcn) |
| **Lucide React** | 0.469.0 | Icon library |
| **Recharts** | 2.15.0 | Charts (bar, donut, line) |
| **Poppins** | Google Fonts | Application typeface |
| **next-themes** | latest | Light/dark mode |
| **Sonner** | latest | Toast notifications |
| **cmdk** | latest | Command palette (⌘K) |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js API Routes** | 15.1.4 | REST endpoints under `app/api/` |
| **Next.js Server Actions** | 15.1.4 | Form mutations (no separate API needed) |
| **Prisma ORM** | 6.19.3 | Database client and schema management |
| **NextAuth.js** | 5.0.0-beta | Authentication (credentials provider) |
| **bcryptjs** | 2.4.3 | Password hashing |
| **jose** | 5.9.6 | JWT signing for QR tokens |
| **html5-qrcode** | 2.3.8 | Camera-based QR scanning on student devices |
| **qrcode** | 1.5.4 | QR code image generation (teacher/event screens) |
| **Leaflet + react-leaflet** | 1.9.4 / 5.0.0 | Interactive map for scan location reports |
| **xlsx** | 0.18.5 | Reading/writing Excel timetable files (scripts only) |

### Database

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary database |
| **Neon** | Serverless Postgres hosting (current — free tier) |
| **Prisma Migrate** | Schema migrations |

### Infrastructure (current)

| Component | Provider | Notes |
|-----------|---------|-------|
| App hosting | Vercel (free/hobby) | CI/CD from GitHub `main` branch |
| Database | Neon (free tier) | Auto-suspends after 5 min idle |
| File storage | None | No files stored; timetable Excel is local |
| Email | None | No email notifications implemented |
| CDN | Vercel Edge Network | Automatic |

---

## 3. Architecture

### Request flow

```
Browser (student/teacher/admin)
    │
    ▼
Vercel Edge Network (CDN + TLS termination)
    │
    ▼
Next.js App Server
    ├── Server Components  → render HTML + fetch data from Postgres
    ├── Server Actions     → form mutations (create/update/delete)
    ├── API Routes         → REST endpoints (QR scan, live session polling)
    └── Client Components → interactive UI (scanner, QR display, charts)
    │
    ▼
Prisma ORM
    │
    ▼
PostgreSQL (Neon / self-hosted)
```

### App Router structure

```
app/
├── (auth)
│   └── login/             ← Login page (email OR phone number)
├── admin/                 ← Admin layout + pages
│   ├── academics/         ← Departments, classes, subjects
│   ├── offerings/         ← Subject→class→teacher assignments
│   ├── people/            ← User management
│   ├── routine/           ← Visual timetable editor (5×8 grid)
│   ├── substitutions/     ← Substitution approval queue
│   ├── import/            ← Bulk student import (phone,name CSV)
│   └── location-test/     ← GPS diagnostic tool
├── teacher/               ← Teacher layout + pages
│   ├── page.tsx           ← My Day dashboard
│   ├── timetable/         ← Weekly schedule view
│   ├── session/[id]/      ← Live session (QR display, roster)
│   └── substitutions/     ← Request/manage substitutions
├── student/               ← Student layout + pages
│   ├── page.tsx           ← Attendance overview
│   ├── scan/              ← QR scanner
│   ├── events/            ← Event attendance scanner
│   └── timetable/         ← Read-only weekly timetable
├── reports/               ← Reports (teacher: own classes; admin: all)
│   ├── page.tsx           ← Overview + trend chart
│   ├── offerings/         ← By subject list
│   ├── offering/[id]/     ← Student register + CSV export
│   ├── students/          ← By student list
│   ├── student/[id]/      ← Individual student report
│   ├── session/[id]/      ← Session-level report + map
│   └── defaulters/        ← Below-75% drill-down + CSV
├── events/                ← Events (teacher + admin)
│   ├── page.tsx           ← Events list + approval queue
│   ├── new/               ← Create event
│   └── [id]/              ← Event detail + live QR + attendance
└── settings/
    └── change-password/   ← Password change (all roles)
```

### Authentication

- **Provider:** NextAuth Credentials
- **Strategy:** JWT (stateless, no database sessions)
- **Login identifier:** Email (teachers/admin) OR phone number (students — 10–12 digits auto-detected)
- **Password:** bcrypt with cost factor 10
- **Session TTL:** 30 days (NextAuth default JWT)
- **Token storage:** HttpOnly cookie

### QR token system

```
Session QR (rotating, 12s TTL):
  sign({ sessionId, nonce, kind:"session" }, session.qrSecret) → JWT
  → teacher screen regenerates every 12s
  → student scans → server verifies signature + expiry

Personal QR (permanent):
  sign({ userId, kind:"personal" }, user.personalQrSecret) → JWT
  → student's digital ID for teacher's manual override
  → no expiry; teacher scans to mark present without geofence

Event QR (static, 24h TTL):
  sign({ eventId, kind:"event" }, event.qrSecret) → JWT
  → displayed while event.status === "OPEN"
  → students scan once per event (idempotent)
```

### Geofencing

- Teacher device captures GPS when opening session (`navigator.geolocation`, `enableHighAccuracy: true`)
- If GPS accuracy > 150 m (PC/weak indoor signal), anchor is **not set** → no geofence
- Stored: `Session.geoLat`, `Session.geoLng`, `Session.geoRadiusM` (default 75 m)
- Student scan: server runs **haversine distance** → if > 75 m → rejected
- Device binding: first device to scan binds to account; different device → hard block (teacher must reset)
- Anti-proxy: if device is bound to another student → blocked immediately

---

## 4. Feature Inventory

### Admin

| Feature | Location | Notes |
|---------|---------|-------|
| Overview dashboard | `/admin` | Stats, charts, quick actions, substitution alerts |
| Academics (Dept/Class/Subject) | `/admin/academics` | Tabbed CRUD |
| People management | `/admin/people` | Filter by role, device binding reset |
| Offerings (subject→class→teacher) | `/admin/offerings` | Multi-teacher per subject supported (changed from unique constraint) |
| Routine editor | `/admin/routine` | Visual 5×8 grid, per-section, class-first picker |
| Student import | `/admin/import` | Preview → Confirm flow, phone+name CSV, bulk enroll |
| Substitution approvals | `/admin/substitutions` | Approve/reject, stats, CSV export |
| Event management | `/events` | Create/approve events, class-wise targeting |
| Location diagnostic | `/admin/location-test` | GPS accuracy test with Leaflet map |
| Reports (all classes) | `/reports` | Same report pages as teacher, but sees everything |

### Teacher

| Feature | Location | Notes |
|---------|---------|-------|
| My Day | `/teacher` | Up-next banner, today's classes, IST-aware |
| My Timetable | `/teacher/timetable` | Read-only 5×8 grid view of own schedule |
| Open session | My Day / My Courses | GPS geofence, duration timer, auto-close |
| Live session | `/teacher/session/[id]` | Rotating QR (12s), live roster, presentation mode, manual scan |
| Substitution requests | `/teacher/substitutions` | Send/receive, single class or leave planner (date range) |
| Classes conducted chart | `/reports` | Horizontal bar chart per subject, teacher-only |
| Reports (own classes) | `/reports` | Trend chart, per-subject health, defaulters |

### Student

| Feature | Location | Notes |
|---------|---------|-------|
| Attendance overview | `/student` | Donut chart, below-75% alert, subject list |
| QR scanner | `/student/scan` | Camera, GPS, 20s timeout, device binding |
| Event scanner | `/student/events` | Lists open events, in-app camera scan |
| Timetable | `/student/timetable` | Read-only weekly schedule |
| Change password | `/settings/change-password` | All roles |

### Events

| Feature | Notes |
|---------|-------|
| Create event | Admin = auto-approved; Teacher = pending |
| Class-wise targeting | Multi-select checkboxes (Year 1/2 groups, select-all per group) |
| Static QR | 24h JWT, displayed while event is OPEN |
| Attendance tracking | Idempotent scan, live count on event page |
| Export (planned) | Not yet implemented |

---

## 5. Data Model

```
Department
  └── ClassSection (many)         year: 1|2, stream: COMMON|FINANCE|HR|...
        ├── Offering (many)       subject × teacher × term
        │     └── Session (many)  one attendance-taking event
        │           └── AttendanceRecord (many)
        ├── Enrollment (many)     student membership
        └── ScheduledClass (many) weekly timetable slot

User (ADMIN | TEACHER | STUDENT)
  ├── phone?          students log in with phone number
  ├── deviceId?       bound on first scan; reset by teacher/admin
  ├── personalQrSecret  permanent digital ID for manual scan
  ├── Offering[]      (teacher) classes they teach
  ├── Session[]       (teacher) sessions they opened
  ├── Enrollment[]    (student) class memberships
  ├── AttendanceRecord[]
  ├── SubstitutionRequest[] (created / assigned / approved)
  ├── Event[]         (created / approved)
  └── EventAttendance[]

SubstitutionRequest
  PENDING_TEACHER → TEACHER_ACCEPTED → APPROVED
                 └→ TEACHER_DECLINED
                 └→ CANCELLED
  (also: REJECTED by admin after teacher accepted)

Event
  PENDING_APPROVAL → APPROVED → OPEN → CLOSED
                  └→ REJECTED         └→ CANCELLED

EventTargetSection  (join: Event ↔ ClassSection)
  Empty = all students; rows = invited classes only
```

### Key constraints

- `Offering.@@unique([subjectId, classSectionId, teacherId, term])` — one offering per subject/class/teacher/term (allows multiple teachers per subject)
- `AttendanceRecord.@@unique([sessionId, studentId])` — idempotent scans
- `EventAttendance.@@unique([eventId, studentId])` — idempotent event scans
- `Enrollment.@@unique([studentId, classSectionId])` — no duplicate enrollments

---

## 6. Environment Variables

Create `.env` at project root (never commit):

```env
# ── Database ──────────────────────────────────────────────────────────────
# Neon direct connection (for migrations and scripts)
DATABASE_URL="postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# For production with pgBouncer connection pooling (recommended):
# DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?pgbouncer=true&connect_timeout=15&sslmode=require"

# ── Auth ──────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="https://your-domain.com"   # required in production

# ── App ───────────────────────────────────────────────────────────────────
NODE_ENV="production"
```

### Generating secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# Or: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 7. Local Development Setup

### Prerequisites

- Node.js 20+ (LTS)
- npm 10+
- Git

### Steps

```bash
# 1. Clone
git clone https://github.com/saugatag76/iem-mba-attendance.git
cd iem-mba-attendance

# 2. Install dependencies
npm install

# 3. Environment
cp .env.example .env   # (create this file manually if not present)
# Fill in DATABASE_URL and NEXTAUTH_SECRET

# 4. Database — generate client + run migrations
npx prisma generate
npx prisma migrate deploy

# 5. Seed (first time only)
npm run db:seed

# 6. Dev server
npm run dev
# → http://localhost:3000

# Test accounts (after seed):
# admin@iem.edu / admin123
# nm@iem.edu / teach123  (Dr. Nivedita Mandal)
# seca.s1@iem.edu / stud123  (Sec A Student 1)
# demo.teacher@iem.edu / demo123  (Demo Teacher — works any day/time)
# demo.student@iem.edu / demo123  (Demo Student)
```

### Common scripts

```bash
npm run dev              # Start dev server (hot reload)
npm run build            # Production build
npm run start            # Start production server (after build)
npx prisma studio        # DB GUI at localhost:5555
npx prisma migrate dev   # Create + apply a new migration
npx prisma db seed       # Re-run seed (idempotent)
npx tsx scripts/parse-timetable.ts  # Re-parse timetable Excel → JSON
npx tsx scripts/setup-demo-accounts.ts  # Reset demo accounts
npx tsx scripts/diff-timetable.ts   # Compare old vs new timetable Excel
```

---

## 8. Current Deployment (Vercel + Neon Free)

### What's working

- CI/CD: push to `main` → Vercel auto-deploys (3–4 min)
- TLS: Vercel provides HTTPS automatically
- CDN: Static assets cached at Vercel Edge
- DB: Neon serverless Postgres (Singapore region)

### Known issues with free tier

| Issue | Impact | Fix |
|-------|--------|-----|
| Neon **auto-suspends** after 5 min idle | First request after idle = 1–3s delay + `E57P01` connection errors | Upgrade to Neon Pro, or switch to self-hosted |
| Vercel **Hobby plan** has 100 GB-hrs/month | May hit limits with large deployments | Upgrade to Vercel Pro ($20/mo) |
| No **persistent storage** | Fine — no file storage needed | N/A |
| No **cron jobs** | Planned: auto-close expired sessions runs on-demand only | Add Vercel Cron or external cron |
| `prisma generate` **EPERM on Windows** | Dev machine issue — DLL locked by running server | Restart server before running generate |

---

## 9. Production Readiness — Gap Analysis

### Current state vs production-grade

| Dimension | Current (Vercel Free) | Production Required | Priority |
|-----------|----------------------|--------------------| --------|
| **Database** | Neon free (auto-suspend) | Neon Pro OR self-hosted Postgres | 🔴 Critical |
| **Connection pooling** | None (direct connections) | PgBouncer / Neon Pooler | 🔴 Critical |
| **Domain** | `*.vercel.app` subdomain | Custom domain (e.g. `attendance.iem.edu`) | 🔴 Critical |
| **SSL/TLS** | Vercel-managed ✓ | Custom domain cert (Let's Encrypt or Cloudflare) | 🟡 On domain setup |
| **Auth secret rotation** | Single static secret | Secret rotation procedure | 🟡 Medium |
| **Environment secrets** | Vercel env vars | Vault / secrets manager | 🟢 Low (Vercel is fine) |
| **Error monitoring** | None | Sentry (free tier sufficient) | 🟡 Medium |
| **Uptime monitoring** | None | UptimeRobot / Better Uptime (free) | 🟡 Medium |
| **DB backups** | Neon auto-backup (7 days) | Daily backups, off-site retention | 🟡 Medium |
| **Rate limiting** | None | Vercel Firewall / middleware rate limit | 🟡 Medium |
| **Email notifications** | None | SMTP/Resend for password resets | 🟡 Medium |
| **Logging** | Vercel logs (1 day retention) | Structured logs with retention | 🟢 Low |
| **Auto-close expired sessions** | Manual / on-request | Vercel Cron every 5 min | 🟢 Low |
| **CDN for assets** | Vercel Edge ✓ | Same (or Cloudflare in front) | ✅ Done |
| **HTTPS** | ✓ | ✓ | ✅ Done |
| **JWT secret** | Set in env vars | ✓ (already parametrised) | ✅ Done |

---

## 10. Recommended Production Architecture

```
Users (browsers / phones)
        │
        ▼
   Cloudflare (DNS + CDN + DDoS protection) ← free tier sufficient
        │
        ▼
   Vercel Pro  (or DigitalOcean App Platform)
   Next.js application server
        │
        ├── Static assets → Vercel CDN (cached globally)
        └── Dynamic requests → Next.js server functions
                │
                ▼
        PgBouncer (connection pooler)
                │
                ▼
        PostgreSQL 16
        (VPS: DigitalOcean Managed DB or self-hosted)
```

### Hosting options comparison

| Option | Monthly cost | Pros | Cons |
|--------|-------------|------|------|
| **Vercel Pro** | $20 | Zero-ops, instant deploy, great DX | Less control, Serverless limits |
| **DigitalOcean App Platform** | $12–25 | Managed, simple pricing | Slower cold starts |
| **DigitalOcean Droplet (VPS)** | $6–12 | Full control, cheapest | Manual nginx, SSL setup |
| **Hetzner VPS (EU/India)** | €4–8 | Cheapest, good for India latency | Manual setup, EU data center |

**Recommendation for IEM:** Vercel Pro for the app + DigitalOcean Managed Postgres OR a DigitalOcean Droplet with self-hosted Postgres (decided by user). This gives a managed app layer with a reliable self-managed database.

---

## 11. Database — Self-Hosted Postgres on VPS

Since the team has chosen self-hosted Postgres, here is the full setup guide.

### Recommended VPS

- **DigitalOcean Droplet** — 2 vCPU / 4 GB RAM / 80 GB SSD — ~$24/mo
- **Hetzner CX21** — 2 vCPU / 4 GB RAM / 40 GB SSD — ~€6/mo (good latency from India)
- **OS:** Ubuntu 22.04 LTS

### Install PostgreSQL 16

```bash
# On VPS as root/sudo
sudo apt update && sudo apt upgrade -y
sudo apt install -y postgresql-16 postgresql-contrib

# Start and enable
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create DB and user
sudo -u postgres psql << 'SQL'
CREATE USER iem_user WITH PASSWORD 'strong-random-password-here';
CREATE DATABASE iem_attendance OWNER iem_user;
GRANT ALL PRIVILEGES ON DATABASE iem_attendance TO iem_user;
SQL
```

### Configure remote access

```bash
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost'   # keep localhost only; use SSH tunnel from app server
# OR if app is on different server:
listen_addresses = '*'

# /etc/postgresql/16/main/pg_hba.conf  — add:
host  iem_attendance  iem_user  <app-server-ip>/32  scram-sha-256
```

### Install PgBouncer (connection pooler)

```bash
sudo apt install -y pgbouncer

# /etc/pgbouncer/pgbouncer.ini
[databases]
iem_attendance = host=127.0.0.1 port=5432 dbname=iem_attendance

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction      # important for Prisma
max_client_conn = 200
default_pool_size = 20
server_reset_query = DISCARD ALL
```

```bash
# /etc/pgbouncer/userlist.txt
"iem_user" "scram-sha-256$<hash>"
# Generate hash: psql -c "SELECT concat('\"', rolname, '\" \"', rolpassword, '\"') FROM pg_authid WHERE rolname='iem_user';"

sudo systemctl enable pgbouncer
sudo systemctl start pgbouncer
```

### Update DATABASE_URL for production

```env
# Via PgBouncer (transaction mode — required with Prisma):
DATABASE_URL="postgresql://iem_user:password@db-server-ip:6432/iem_attendance?sslmode=disable&pgbouncer=true&connect_timeout=10"

# Direct connection (for migrations only — use a separate env var):
DATABASE_DIRECT_URL="postgresql://iem_user:password@db-server-ip:5432/iem_attendance?sslmode=require"
```

In `prisma/schema.prisma` add:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL")  # used by prisma migrate
}
```

### Run migrations on deploy

```bash
# In your deploy script / CI pipeline:
DATABASE_URL=$DATABASE_DIRECT_URL npx prisma migrate deploy
```

### Firewall (UFW)

```bash
sudo ufw allow ssh
sudo ufw allow from <app-server-ip> to any port 6432  # PgBouncer from app only
sudo ufw enable
```

---

## 12. Security Hardening Checklist

### Authentication & access

- [x] Passwords hashed with bcrypt (cost 10)
- [x] JWT signed with `NEXTAUTH_SECRET` (env var)
- [x] Phone-number login (no email guessing for students)
- [x] Device binding (one device per student account)
- [x] Cross-device proxy detection (device bound to another student → hard block)
- [ ] **TODO:** Rate-limit `/api/auth` and `/api/attendance/scan` (add Vercel Firewall rule or middleware)
- [ ] **TODO:** Add CSRF protection for server actions (Next.js 15 has built-in CSRF for server actions — verify it's enabled)
- [ ] **TODO:** Session invalidation on password change (currently old JWT still works until expiry)

### API security

- [x] All sensitive routes check session role server-side
- [x] Teacher can only see own sessions/offerings
- [x] Student scan validates enrollment in class
- [x] Event scan validates class section eligibility
- [ ] **TODO:** Add `X-Frame-Options: DENY` and `Content-Security-Policy` headers (add to `next.config.js`)

### Database

- [ ] **TODO:** DB user has minimal privileges (no CREATE TABLE in production — only SELECT/INSERT/UPDATE/DELETE)
- [ ] **TODO:** DB not exposed to public internet (firewall to app server IP only)
- [ ] **TODO:** Enable SSL on Postgres connection (`sslmode=require`)
- [x] All passwords never stored in plaintext

### Secrets

- [x] `.env` in `.gitignore`
- [x] Secrets in Vercel environment variables (not in code)
- [ ] **TODO:** Rotate `NEXTAUTH_SECRET` annually (all active sessions invalidated — communicate to users)

### Headers to add in `next.config.js`

```js
// next.config.js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self)' },
];

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

---

## 13. Monitoring & Observability

### Error monitoring — Sentry (recommended, free tier)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Add to `.env`:
```env
SENTRY_DSN="https://xxx@sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

### Uptime monitoring — UptimeRobot (free)

1. Create account at uptimerobot.com
2. Add monitor: `https://attendance.iem.edu/api/health`
3. Create `/app/api/health/route.ts`:
```ts
export async function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
```
4. Alert to IT team email/WhatsApp on downtime

### Application metrics (optional)

For medium scale (500–2000 students), basic Vercel Analytics is sufficient:
- Enable in Vercel dashboard → Analytics tab
- Tracks page views, Web Vitals (LCP, FID, CLS), error rates

### Database monitoring

```sql
-- Run weekly to catch slow queries:
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check connection count:
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Table sizes:
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;
```

---

## 14. Backup & Recovery

### Automated daily backup (self-hosted Postgres)

```bash
# /etc/cron.daily/pg-backup (make executable: chmod +x)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgres"
mkdir -p $BACKUP_DIR

# Dump compressed
pg_dump -U iem_user -h localhost iem_attendance | gzip > "$BACKUP_DIR/iem_$DATE.sql.gz"

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Optional: sync to object storage (e.g. DigitalOcean Spaces / S3)
# aws s3 cp "$BACKUP_DIR/iem_$DATE.sql.gz" s3://iem-backups/postgres/
```

### Restore procedure

```bash
# Stop app (to prevent writes during restore)
# SSH to DB server:
gunzip -c /var/backups/postgres/iem_20260601_000000.sql.gz | psql -U iem_user -h localhost iem_attendance

# Verify:
psql -U iem_user -h localhost iem_attendance -c "\dt"
```

### Recovery time objectives (RTO/RPO)

| Scenario | Target RTO | Target RPO | Approach |
|----------|-----------|-----------|---------|
| App crash | < 5 min | 0 | Vercel auto-restarts |
| DB corruption | < 2 hours | 24 hours | Restore from daily backup |
| VPS failure | < 4 hours | 24 hours | Spin new VPS, restore backup, point DNS |
| Total data loss | < 8 hours | 24 hours | Restore latest backup to new VPS |

---

## 15. Runbook — IT Operations

### Restarting the application

```bash
# Vercel (auto-redeploys on push to main):
git push origin main

# Manual redeploy via Vercel CLI:
npx vercel --prod

# Emergency rollback (Vercel dashboard):
# Deployments → previous deployment → "Promote to Production"
```

### Adding a new teacher

1. Admin → People → Add user → Role: TEACHER → set password
2. Admin → Offerings → Create offering → assign their subjects/classes
3. Admin → Routine → assign their weekly schedule slots
4. Communicate login: `{initials}@iem.edu` / `teach123` (tell them to change password)

### Adding a new class section (e.g. new batch)

1. Admin → Academics → Classes → Add class
2. Admin → Academics → Subjects → verify subjects exist
3. Admin → Offerings → create offerings for each subject+teacher
4. Admin → Routine → assign timetable slots
5. Admin → Import → bulk import students (phone,name CSV format)

### Importing students (bulk)

```
CSV format (no header row):
9876543210,Rahul Sharma
9123456789,Priya Das

Admin → Import → upload file OR paste → Preview → Confirm
Students log in with their phone number + default password (stud123)
```

### Resetting a student's device (new phone)

1. Admin → People → find student → click "Reset device" button
2. OR: Teacher → session report → flagged scan row → "Reset device"
3. Student's next scan on new device becomes their new bound device

### Resetting a password (admin)

```
Currently: Admin → People → re-save the user with a new password
(the "Add user" form is an upsert — same email updates the record)
```

### Updating the timetable (new semester)

```bash
# 1. Get new Excel file from academic office
# 2. Update XLSX_PATH in scripts/parse-timetable.ts to new filename
# 3. Check for changes:
npx tsx scripts/diff-timetable.ts

# 4. If changes look correct, re-parse:
npx tsx scripts/parse-timetable.ts

# 5. Re-seed (safe — uses upsert):
npm run db:seed

# 6. Admin → Routine → verify timetable looks correct
```

### Checking database health

```bash
# Via psql on DB server:
psql -U iem_user -h localhost iem_attendance

# Check active connections:
SELECT count(*), state FROM pg_stat_activity WHERE datname='iem_attendance' GROUP BY state;

# Check database size:
SELECT pg_size_pretty(pg_database_size('iem_attendance'));

# Check recent sessions:
SELECT s.id, u.name, s.status, s.createdAt FROM "Session" s JOIN "User" u ON u.id=s."teacherId" ORDER BY s."createdAt" DESC LIMIT 10;
```

---

## 16. Known Gaps & Technical Debt

### Security gaps (must fix before production)

1. **No rate limiting** — `/api/attendance/scan` and `/api/auth` can be brute-forced. Add Vercel Firewall rules or a `middleware.ts` rate-limiter.
2. **Session not invalidated on password change** — If a teacher changes their password, old JWT tokens still work until they expire (30 days). To fix: store a `passwordChangedAt` timestamp and check it in the JWT callback.
3. **No CSRF hardening headers** — Add security headers in `next.config.js` (see §12).

### Missing features (nice to have)

1. **Email notifications** — No emails sent anywhere. Substitution requests, event approvals, etc. are visible only in-app. Add Resend/Nodemailer for notifications.
2. **Push notifications** — When Teacher Y receives a substitution request, they only see it on next login. Browser Push API would allow real-time alerts.
3. **Event CSV export** — Events attendance has no CSV export yet (class session reports do).
4. **Auto-close expired sessions** — Sessions with `expiresAt` in the past are closed on the next API request, not proactively. Add a Vercel Cron job every 5 minutes.
5. **Student phone update** — No UI for admin to update a student's phone number (only device reset is available).
6. **Multi-department support** — Currently one department (MBA). Schema supports multiple but UI doesn't expose it.
7. **Attendance correction** — Teacher cannot mark a student absent if they accidentally scanned. No attendance correction UI.

### Technical debt

1. **`prisma generate` EPERM on Windows** — On Windows dev machines, you must stop the dev server before running `prisma generate`. This is a Prisma limitation with the Windows native query engine binary.
2. **Timetable times in 12-hour format** — Some `startTime`/`endTime` values in the database are stored as 12-hour (`"02:30"` for 2:30 PM) because the source Excel had 12-hour times without AM/PM. Sorting works via `slotIndex`; display works fine; but time-string comparison is unreliable.
3. **Demo account hack** — `demo.teacher@iem.edu` has a special case in `teacher/page.tsx` to show all offerings on weekends. This is a simple email check; a cleaner approach would be a `User.isDemoAccount` boolean.
4. **No real-time** — The live session roster polls every 4 seconds. This is fine for current scale but WebSockets would give a better experience.

---

## 17. Timetable Data Pipeline

```
Excel file (from academic office)
    │
    ▼
scripts/parse-timetable.ts
    │  reads: XLSX_PATH (currently: Timetable_term1_term4_june,2026_v8.xlsx)
    │  uses: FACULTY map (lib/facultyInitials.ts) + ALIAS map
    │  outputs: prisma/timetable-data.json
    │
    ▼
prisma/timetable-data.json
    │  contains: sections, subjects, teachers, offerings, schedule
    │
    ▼
prisma/seed.ts  (npm run db:seed)
    │  upserts: departments, teachers, subjects, sections, offerings
    │  deletes + recreates: scheduledClasses
    │  creates: 5 sample students per section
```

### Faculty initials map

`lib/facultyInitials.ts` is the **single source of truth** for faculty initials → full name mapping. Both `parse-timetable.ts` and the `Avatar` component use it. When adding new faculty, update this file.

### Adding a new academic year

1. Create new Excel timetable file
2. Update `XLSX_PATH` in `parse-timetable.ts`
3. Add new term values to `TERMS` array in `app/admin/offerings/page.tsx`
4. Run the pipeline above
5. Update student enrollments (bulk import)

---

## 18. Key Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Next.js App Router (not Pages Router) | Server components reduce client JS; server actions simplify form handling; easier to add streaming later | Jan 2026 |
| Credentials auth (not OAuth) | Institution doesn't have Google Workspace or SSO; phone-number login for students requires custom auth | Jan 2026 |
| Phone number login for students | Students don't have institutional emails; phone is universal | May 2026 |
| Rotating QR (12s) for sessions | Prevents WhatsApp screenshot sharing — a QR becomes invalid before it can be forwarded | Feb 2026 |
| Static QR for events | Events are one-time; students scan at leisure at the venue; anti-screenshot less important | Jun 2026 |
| Device binding (localStorage UUID) | Deters proxy attendance from different phones; not hardware fingerprinting (cannot be enforced on web) | Mar 2026 |
| IST timezone explicit in server code | Vercel runs in UTC; `new Date().getDay()` returns Friday on Saturday morning in India | Apr 2026 |
| Multi-teacher per subject | Real-world: OB at Sec A taught by different teachers on different days (PC on Tue/Fri, CM on Thu); removed unique constraint | Jun 2026 |
| Haversine geofencing (75m) | Industry standard for indoor geofencing; GPS accuracy ±15–30m leaves ~45m true buffer | Feb 2026 |
| PgBouncer transaction mode | Prisma uses a connection per request; transaction mode pools efficiently; session mode not compatible | Jun 2026 |
| `prisma db push` over `migrate dev` | On Windows, migrate dev requires interactive terminal; db push works in CI/CD | Throughout |

---

## Contacts & Repository

| Item | Value |
|------|-------|
| GitHub | `github.com/saugatag76/iem-mba-attendance` |
| Vercel project | `iem-mba-attendance` (saugatag76 team) |
| Neon project | `iem-mba-attendance` |
| Admin login | `admin@iem.edu` |
| Demo teacher | `demo.teacher@iem.edu` / `demo123` |
| Demo student | `demo.student@iem.edu` / `demo123` |

---

*This document should be kept in sync with the codebase. Major feature additions, architectural decisions, and production changes should be appended to §18.*
