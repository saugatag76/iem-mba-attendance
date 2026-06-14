"use client";

/**
 * A best-effort stable device identifier kept in localStorage. Bound to the student's
 * account on first scan; later mismatches are flagged server-side. (A browser cannot
 * truly fingerprint hardware, so this deters — not absolutely prevents — account sharing.)
 */
const KEY = "qratt.deviceId";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
