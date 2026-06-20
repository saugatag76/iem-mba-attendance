"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/** Reads a `?toast=` (and optional `?toastType=error`) flash param set by server
 *  actions on redirect, fires a Sonner toast, then strips it from the URL. */
export function ToastListener() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const msg = params.get("toast");
    if (!msg) return;
    const type = params.get("toastType");
    if (type === "error") toast.error(msg);
    else toast.success(msg);

    const next = new URLSearchParams(params.toString());
    next.delete("toast");
    next.delete("toastType");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
