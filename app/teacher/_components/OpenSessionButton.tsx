"use client";

import { useRef, useState } from "react";
import { openSession } from "../actions";

export function OpenSessionButton({ offeringId }: { offeringId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function start() {
    setBusy(true);
    const submit = () => formRef.current?.requestSubmit();
    if (!navigator.geolocation) return submit(); // no GPS → open without geofence
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current) latRef.current.value = String(pos.coords.latitude);
        if (lngRef.current) lngRef.current.value = String(pos.coords.longitude);
        submit();
      },
      () => submit(), // denied / failed → open without geofence
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <form ref={formRef} action={openSession}>
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="radius" value={75} />
      <input ref={latRef} type="hidden" name="lat" />
      <input ref={lngRef} type="hidden" name="lng" />
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Opening…" : "Open session"}
      </button>
    </form>
  );
}
