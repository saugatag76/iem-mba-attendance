import { requireRole } from "@/lib/session";
import { CodeEntry } from "./CodeEntry";

export default async function ScanPage() {
  await requireRole("STUDENT", "ADMIN");

  return (
    <div className="flex flex-col items-center pt-2">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-foreground">Mark attendance</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Enter the 6-digit code shown on your teacher&apos;s screen.
      </p>
      <CodeEntry />
    </div>
  );
}
