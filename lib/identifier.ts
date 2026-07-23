/** A student logs in with either a phone number (Year 1) or a 14-digit
 *  enrollment number (Year 2) — never both, never an email. */
export type IdentifierKind = "phone" | "enrollment";

const PHONE_RE = /^\d{10,12}$/;
const ENROLLMENT_RE = /^\d{14}$/;

/** Classifies a typed identifier as a phone number (10–12 digits, year-1) or an
 *  enrollment number (14 digits, year-2). Returns null if neither shape matches. */
export function classifyIdentifier(raw: string): { kind: IdentifierKind; value: string } | null {
  const digits = raw.trim().replace(/[\s+\-()]/g, "");
  if (PHONE_RE.test(digits)) return { kind: "phone", value: digits };
  if (ENROLLMENT_RE.test(digits)) return { kind: "enrollment", value: digits };
  return null;
}

/** Internal, never-shown email derived from the login identifier — `p<phone>`
 *  for year-1, `e<enrollmentNo>` for year-2. */
export function identifierEmail(kind: IdentifierKind, value: string): string {
  return kind === "phone" ? `p${value}@iem.internal` : `e${value}@iem.internal`;
}
