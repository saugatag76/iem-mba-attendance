import { requireRole } from "@/lib/session";
import { PageHeader } from "@/app/_components/ui";
import { LocationTester } from "./LocationTester";

export const dynamic = "force-dynamic";

export default async function LocationTestPage() {
  await requireRole("ADMIN", "TEACHER");
  return (
    <div>
      <PageHeader
        title="Geofence designer"
        subtitle="Click or drag on the map to set an anchor point, then use the slider to preview exactly how far the geofence radius reaches. Use 'Use my location' to jump to your current GPS position."
      />
      <LocationTester />
    </div>
  );
}
