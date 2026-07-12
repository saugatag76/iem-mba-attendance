# Student Guide

Login at `/login` with your **10-digit phone number** (Year 1) or your **14-digit enrollment number** (Year 2), plus your password. New students are given a shared default password (ask your admin/teacher — not published here) and are **required to change it** the first time they log in — you won't be able to access anything else or mark attendance until you do.

After login you land on your **Home** dashboard (`/student`).

## 1. Home — `/student`
- **Mark attendance** — the main button. Tap this at the start of every class.
- **Attendance overview** — a donut chart of your overall attendance plus a per-subject breakdown, sorted with your weakest subjects first. Any subject below **75%** is flagged with a warning badge so you know where you're at risk.
- **Today's schedule** — your classes for today.
- **Your personal code** — a permanent 6-digit code unique to you (your "digital ID"). If your phone isn't working, read this out to your teacher — they can enter it to mark you present manually. They can also mark you present directly from their roster without any code at all if your phone is completely dead.

## 2. Marking attendance — `/student/scan`
1. Tap **Mark attendance** from Home.
2. Type the 6-digit code your teacher is displaying. Unlike the old QR system, this code does not rotate — it stays valid for the whole session.
3. Allow **location access** when prompted — every session has an active geofence, so this is always required to confirm you're on campus.
   - If you **deny** location permission, you'll be stopped and asked to enable it before continuing.
   - If your device simply **can't get a GPS fix** (e.g. weak signal indoors), you'll be warned and given the choice to continue anyway — doing so marks you **absent** for location non-compliance, but your teacher can see this on their live roster and mark you present manually once they've verified you're actually there.
4. The app also checks: the code matches an open session, the session is still open, you're enrolled in that class, and you haven't already been marked present for it.
5. On success you'll see a confirmation. On failure you'll see the reason and a **Try again** option.

### Notes on devices
- The first device you check in with gets "bound" to your account.
- If you switch to a new phone, ask your teacher or admin to reset your device binding — otherwise check-ins from the new device are blocked (this prevents one student checking in on another's behalf).

## 3. Timetable — `/student/timetable`
A read-only view of your full weekly class schedule — useful for checking room/time without needing the teacher's announcement.

## 4. Events — `/student/events`
For one-time events (separate from regular class attendance), enter the 6-digit event code shown at the venue to record your attendance.

## Quick tips
- Keep location services **on** during class — without it, your check-in will be marked absent until your teacher manually confirms you.
- Check your **Attendance overview** regularly. Anything below 75% needs attention — talk to your teacher if you think a session is missing.
- If you can't type the code yourself, ask your teacher to enter your **personal code** from your Home page instead — or, if your phone isn't available at all, they can mark you present straight from their class roster.
- Forgot your password, or still on the temporary default one? Go to **Change password** (in the sidebar) any time.
