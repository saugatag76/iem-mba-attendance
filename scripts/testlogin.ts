// Quick HTTP login test against the running dev server.
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
  const sess = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookies.header() },
  }).then((r) => r.json());
  console.log(
    `  ${email.padEnd(20)} "${password}" → ${sess?.user ? `OK (${sess.user.role})` : "FAILED"}`,
  );
}

(async () => {
  console.log("Login tests (with case-insensitive fix):\n");
  await login("finA1@iem.edu", "stud123"); // capital A — the previously broken case
  await login("fina1@iem.edu", "stud123"); // lowercase — should also work
  await login("FINA1@IEM.EDU", "stud123"); // all caps — should also work
  await login("teacher1@iem.edu", "teach123");
  await login("finA1@iem.edu", "wrongpass"); // should FAIL
})();
