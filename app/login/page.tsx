import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { homeForRole } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(homeForRole(session.user.role));
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    try {
      await signIn("credentials", { email, password, redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e; // re-throw redirect control-flow errors
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <h1 className="mb-1 text-2xl font-bold">QR Attendance</h1>
      <p className="mb-6 text-sm text-gray-500">Sign in to continue</p>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Invalid email or password.
        </p>
      )}

      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="username"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-gray-900"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          className="mt-1 rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white active:scale-[0.99]"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-xs text-gray-400">
        Seeded logins: admin@iem.edu / teacher1@iem.edu / student1@iem.edu
      </p>
    </main>
  );
}
