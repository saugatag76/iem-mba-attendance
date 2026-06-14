// Single source of truth for MBA specialisation streams (matches the Prisma `Stream` enum).
export const STREAMS = [
  { value: "COMMON", label: "Common" },
  { value: "FINANCE", label: "Finance" },
  { value: "HR", label: "HR" },
  { value: "MARKETING", label: "Marketing" },
  { value: "SUPPLY_CHAIN", label: "Supply Chain" },
  { value: "TECH_MANAGEMENT", label: "Tech Mgmt" },
  { value: "ENTREPRENEURSHIP", label: "Entrepreneurship" },
] as const;

export const STREAM_LABEL: Record<string, string> = Object.fromEntries(
  STREAMS.map((s) => [s.value, s.label]),
);
