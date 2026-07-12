// Verifies the new admin sub-pages + reports filtering render correctly.
export {};
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
  const c = jar();
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  c.apply(csrf);
  const { csrfToken } = await csrf.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: c.header() },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: BASE }),
    redirect: "manual",
  });
  c.apply(res);
  return c;
}
const get = (c: ReturnType<typeof jar>, p: string) =>
  fetch(`${BASE}${p}`, { headers: { Cookie: c.header() } }).then((r) => r.text());

let pass = 0,
  fail = 0;
const check = (n: string, ok: boolean) => {
  console.log(`  ${ok ? "✓" : "✗"} ${n}`);
  ok ? pass++ : fail++;
};

(async () => {
  console.log("Admin IA + reports filtering checks:\n");
  const a = await login("admin@iem.edu.in", "Admin@2026");

  const overview = await get(a, "/admin");
  check("admin overview loads (Quick actions)", overview.includes("Quick actions"));
  check("overview not a form dump (no 'Bulk import' here)", !overview.includes("Bulk import"));

  const academics = await get(a, "/admin/academics?tab=subjects");
  check("academics subjects tab lists real subject", /Micro Economics|FRSA|Corporate Strategy/.test(academics));

  const people = await get(a, "/admin/people?role=TEACHER");
  check("people directory shows a teacher", /Dr\.|Prof\./.test(people));

  const offerings = await get(a, "/admin/offerings?stream=FINANCE");
  check("offerings filtered by Finance loads", offerings.includes("Offerings"));

  const reports = await get(a, "/reports?q=corporate");
  check("reports search renders grouped results", reports.includes("Attendance reports"));

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
})();
