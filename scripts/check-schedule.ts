// Verifies the timetable seed surfaces in the UI: teacher home + student weekly timetable.
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
async function get(c: ReturnType<typeof jar>, path: string) {
  return fetch(`${BASE}${path}`, { headers: { Cookie: c.header() } }).then((r) => r.text());
}

let pass = 0,
  fail = 0;
const check = (n: string, ok: boolean) => {
  console.log(`  ${ok ? "✓" : "✗"} ${n}`);
  ok ? pass++ : fail++;
};

(async () => {
  console.log("Schedule UI checks:\n");
  const teacher = await login("nm@iem.edu", "teach123"); // Dr. Nivedita Mandal (Maths/Micro Eco)
  const tHome = await get(teacher, "/teacher");
  check("teacher home loads", tHome.includes("All your classes") || tHome.includes("Today"));
  check("teacher sees a real subject", /Mathematics|Micro Economics/.test(tHome));

  const student = await login("seca.s1@iem.edu", "stud123"); // Sec A student
  const tt = await get(student, "/student/timetable");
  check("student timetable loads", tt.includes("Your timetable"));
  check("timetable shows weekdays", tt.includes("Monday") && tt.includes("Friday"));
  check("timetable shows real classes", /CAB|FRSA|Micro Economics|Mathematics/.test(tt));

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
})();
