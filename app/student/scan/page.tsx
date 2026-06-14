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
    <div className="flex flex-col items-center">
      <h1 className="mb-1 text-lg font-semibold">Scan to mark attendance</h1>
      <p className="mb-6 text-center text-sm text-gray-500">
        Point your camera at the rotating QR on the teacher&apos;s screen.
      </p>
      <Scanner initialToken={t} />
    </div>
  );
}
