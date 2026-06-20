import { requireRole } from "@/lib/session";
import { Scanner } from "./Scanner";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  await requireRole("STUDENT", "ADMIN");
  const { t } = await searchParams;

  return (
    <div className="flex flex-col items-center pt-2">
      <h1 className="mb-1 text-xl font-bold tracking-tight text-foreground">Mark attendance</h1>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Point your camera at the rotating QR on the teacher&apos;s screen.
      </p>
      <Scanner initialToken={t} />
    </div>
  );
}
