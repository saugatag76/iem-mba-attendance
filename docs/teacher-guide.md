# Teacher Guide

Login at `/login` with your `@iem.edu.in` email and password. Email is not case-sensitive. Passwords are not published here — ask your admin, or use **Change password** in the sidebar once logged in.

After login you land on **My Day** (`/teacher`).

## 1. My Day — `/teacher`
Your home screen, showing:
- Stat tiles: today's scheduled classes, total classes you teach, sessions held.
- Substitution stats: requests needing your response, your own requests still pending, and classes you're covering for someone else — each links straight to the relevant tab.
- An **"Up next"** banner for your next scheduled class today, with a primary **Open session** button.
- **Today's classes** — every class on today's schedule (including any you're covering as a substitute), each with its own **Open session** button.
- **My courses** — your full weekly schedule grouped by subject, with a link to each subject's report and a "sub?" shortcut to request a substitute for any slot.

## 2. Opening an attendance session
Click **Open session** on the class you're about to teach:
1. Choose an **auto-close duration**: No limit, 1/5/10/15/20/30/60 minutes, or a custom number of minutes.
2. Click the button — the session opens immediately. A **fixed, pre-surveyed geofence** (~20m around the department) is applied automatically to every session; there's no location prompt or permission step for you to handle.
3. You're taken straight to the **Live Session** page.

## 3. Live Session — `/teacher/session/[id]`
This is your "run the class" screen:
- Shows the subject/class info and a live/closed status badge.
- A **6-digit attendance code** is displayed in large boxed digits. Unlike the old QR system, this code is static for the whole session — it does not rotate. Students open the app and type this code to check in.
- **Presentation mode**: a fullscreen view of the code (with the live present count) you can project for the whole class.
- If you set a timer, a **live countdown** is shown (turns amber under 30s, red under 10s) — the session auto-closes when it hits zero.
- **Present** — everyone checked in so far, in real time, with a "manual" tag for anyone you marked by hand and a flag icon for anything that looked off.
- **Location non-compliant** — students who entered the code but had no location fix (denied/unavailable), so they were marked absent automatically. Each row has a **Mark present** button (asks you to confirm) if you've verified them in person.
- **Not yet marked** — a collapsible panel (tap to expand) listing every enrolled student who hasn't been marked yet, with a search box to jump to a name and a **Mark present** button (asks you to confirm) on each row. Use this when a student's phone is dead or lost — no code needed at all.
- **Close** — manually end the session early.
- **Report** — jump straight to the attendance report for this session.

## 4. Manual fallback (personal code)
Below the live session, while it's open, there's a **Manual fallback** box:
- Ask the student to read out their **6-digit personal code** (shown on their own Home dashboard).
- Type it in, optionally add a short note (e.g. "device not working, verified in person"), and click **Mark present**.
- This has no location check — it's meant for genuine technical issues. For a student whose phone is simply dead, marking them from the **Not yet marked** roster (§3) is usually faster since it doesn't need a code from them at all.

## 5. Substitutions — `/teacher/substitutions`
If you'll be away, request a substitute for a specific class slot ("Sub" link on any class in My Day or My courses) or submit a leave request covering multiple days. The flow is:
1. You request a substitute → the chosen teacher accepts or declines.
2. If they accept, it goes to the admin for final approval.
3. Once approved, the class shows up as "Substitute class" on the covering teacher's My Day, and "Substituted" on yours.

Track your own sent requests and requests waiting on your response under the **Sent** / **Received** tabs.

## 6. Reports — `/reports`
You can view attendance reports for your own classes only. See the [Reports Guide](./reports-guide.md):
- **Overview**: your subjects, average attendance, and a "below 75%" alert.
- **By subject**: drill into a subject for a full register (who attended which session) and export to CSV.
- **By student**: look up an individual student's attendance across your subjects.
- **Session report**: per-session detail, including check-in times, manual-entry tags, flags, and a map of where students checked in from.
- **Export all**: one button, on every reports tab, downloads a single Excel workbook with everything above in one file.

## Quick tips
- Open the session right when class starts and leave it open (presentation mode if you're projecting) — the code stays valid for the whole session, so there's no need to keep refreshing anything.
- If several students show up under "Location non-compliant," it usually means their phone couldn't get a GPS fix indoors — verify in person and use **Mark present** rather than making them retry repeatedly.
- Use the **Not yet marked** roster for anyone without a working phone at all; use the **Manual fallback** code box only when the student can still tell you their personal code.
