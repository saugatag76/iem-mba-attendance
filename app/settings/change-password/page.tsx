import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/app/_components/ui";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ forced?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { forced: forcedParam } = await searchParams;
  const forced = forcedParam === "1";

  return (
    <div className="mx-auto max-w-md">
      {!forced && (
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      )}
      <PageHeader
        title="Change password"
        subtitle={forced ? "You must set a new password before continuing." : "Update your login password."}
      />
      {forced && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>You're using a temporary default password. Set a new one below — you won't be able to mark attendance until you do.</span>
        </div>
      )}
      <ChangePasswordForm forced={forced} />
    </div>
  );
}
