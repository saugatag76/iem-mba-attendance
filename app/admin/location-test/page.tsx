import { requireRole } from "@/lib/session";
import { PageHeader } from "@/app/_components/ui";
import { LocationTester } from "./LocationTester";

export const dynamic = "force-dynamic";

export default async function LocationTestPage() {
  await requireRole("ADMIN", "TEACHER");
  return (
    <div>
      <PageHeader
        title="Location tester"
        subtitle="See exactly what GPS coordinates and accuracy the system captures — and whether your current spot is reliable enough to anchor a geofenced session."
      />
      <LocationTester />
    </div>
  );
}
