import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/app/_components/ui";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireRole("ADMIN");
  const classes = await prisma.classSection.findMany({
    include: { _count: { select: { enrollments: true } } },
    orderBy: [{ year: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Import students"
        subtitle="Paste a CSV or upload a file — preview every row before committing."
      />
      <ImportForm
        classes={classes.map((c) => ({ id: c.id, name: c.name, enrolled: c._count.enrollments }))}
      />
    </div>
  );
}
