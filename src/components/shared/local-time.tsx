"use client";

import { useSyncExternalStore } from "react";

// A moment in the viewer's own time zone. The server doesn't know it, so the first
// render (on the server, and while hydrating) uses UTC and the browser then switches to
// local time. Formatting in local time straight away makes the server and browser
// disagree, which React reports as a hydration error.

const FORMATS = {
  /** Oct 23, 2026 */
  date: { month: "short", day: "numeric", year: "numeric" },
  /** October 23, 2026 */
  longDate: { month: "long", day: "numeric", year: "numeric" },
  /** Oct 23 */
  day: { month: "short", day: "numeric" },
  /** October 23 */
  longDay: { month: "long", day: "numeric" },
  /** Oct 23, 4:05 PM */
  dateTime: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  /** Oct 23, 2026, 4:05 PM */
  full: { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const noopSubscribe = () => () => {};

/** False on the server and while hydrating, true once running in the browser. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function LocalTime({ iso, format = "date" }: { iso: string | Date; format?: keyof typeof FORMATS }) {
  const local = useHydrated();
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return (
    <time dateTime={d.toISOString()}>
      {d.toLocaleString(undefined, { ...FORMATS[format], ...(local ? {} : { timeZone: "UTC" }) })}
    </time>
  );
}
