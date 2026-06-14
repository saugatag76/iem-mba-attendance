export interface DateRange {
  from?: Date;
  to?: Date;
}

/** Parses `from`/`to` (yyyy-mm-dd) search params into a Date range for filtering sessions. */
export function parseDateRange(params: { from?: string; to?: string }): DateRange | undefined {
  const { from, to } = params;
  if (!from && !to) return undefined;
  return {
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59.999`) : undefined,
  };
}

/** Query string carrying the current `from`/`to` params, for links that should preserve the active range. */
export function rangeQuery(params: { from?: string; to?: string }): string {
  const next = new URLSearchParams();
  if (params.from) next.set("from", params.from);
  if (params.to) next.set("to", params.to);
  const s = next.toString();
  return s ? `?${s}` : "";
}
