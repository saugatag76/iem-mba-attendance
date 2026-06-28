import { SignJWT, jwtVerify } from "jose";

/**
 * Two kinds of signed QR payloads:
 *
 * 1. Rotating SESSION token (primary flow): short-lived (~12s), signed with the
 *    session's own `qrSecret`. The teacher screen regenerates it continuously, so a
 *    screenshot is useless seconds later.
 *
 * 2. Permanent PERSONAL token (fallback / digital ID): signed with the user's
 *    `personalQrSecret`. Does not expire; the teacher scans it to mark a student whose
 *    camera failed.
 */

const enc = (secret: string) => new TextEncoder().encode(secret);

// ---- Rotating session QR ----

export const ROTATION_TTL_SECONDS = 12;

export interface SessionTokenPayload {
  sessionId: string;
  nonce: string;
}

export async function signSessionToken(
  sessionId: string,
  qrSecret: string,
  ttlSeconds: number = ROTATION_TTL_SECONDS,
): Promise<string> {
  const nonce = crypto.randomUUID();
  return new SignJWT({ sessionId, nonce, kind: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(enc(qrSecret));
}

export async function verifySessionToken(
  token: string,
  qrSecret: string,
): Promise<SessionTokenPayload> {
  const { payload } = await jwtVerify(token, enc(qrSecret));
  if (payload.kind !== "session" || typeof payload.sessionId !== "string") {
    throw new Error("Not a session token");
  }
  return { sessionId: payload.sessionId, nonce: String(payload.nonce ?? "") };
}

// ---- Permanent personal QR ----

export interface PersonalTokenPayload {
  userId: string;
}

export async function signPersonalToken(
  userId: string,
  personalQrSecret: string,
): Promise<string> {
  return new SignJWT({ userId, kind: "personal" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(enc(personalQrSecret));
}

/**
 * Personal tokens carry no expiry, so we verify the signature only after looking up the
 * user's secret. The caller must first decode the userId (unverified) to fetch the secret,
 * then call this to confirm the signature.
 */
export async function verifyPersonalToken(
  token: string,
  personalQrSecret: string,
): Promise<PersonalTokenPayload> {
  const { payload } = await jwtVerify(token, enc(personalQrSecret));
  if (payload.kind !== "personal" || typeof payload.userId !== "string") {
    throw new Error("Not a personal token");
  }
  return { userId: payload.userId };
}

/** Decode a single claim from a JWT WITHOUT verifying its signature. */
function peekClaim(token: string, key: string): string | null {
  try {
    const [, body] = token.split(".");
    const json = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof json[key] === "string" ? json[key] : null;
  } catch {
    return null;
  }
}

/** Decode the userId from a personal token WITHOUT verifying (to fetch the secret). */
export function peekUserId(token: string): string | null {
  return peekClaim(token, "userId");
}

/** Decode the sessionId from a session token WITHOUT verifying (to fetch the secret). */
export function peekSessionId(token: string): string | null {
  return peekClaim(token, "sessionId");
}

// ---- Static event QR (long-lived, one per event) ----

export async function signEventToken(eventId: string, qrSecret: string): Promise<string> {
  return new SignJWT({ eventId, kind: "event" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(enc(qrSecret));
}

export async function verifyEventToken(token: string, qrSecret: string): Promise<string> {
  const { payload } = await jwtVerify(token, enc(qrSecret));
  if (payload.kind !== "event" || typeof payload.eventId !== "string") {
    throw new Error("Not an event token");
  }
  return payload.eventId;
}

export function peekEventId(token: string): string | null {
  return peekClaim(token, "eventId");
}
