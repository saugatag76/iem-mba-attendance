"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { signEventToken } from "@/lib/qrToken";
import { Loader2 } from "lucide-react";

export function EventQr({ eventId, qrSecret }: { eventId: string; qrSecret: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await signEventToken(eventId, qrSecret);
      const url = await QRCode.toDataURL(token, { width: 300, margin: 2, errorCorrectionLevel: "M" });
      setDataUrl(url);
    })();
  }, [eventId, qrSecret]);

  if (!dataUrl)
    return (
      <div className="flex h-[300px] w-[300px] items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <img
      src={dataUrl}
      alt="Event attendance QR code"
      className="rounded-xl border border-border shadow-sm"
      width={300}
      height={300}
    />
  );
}
