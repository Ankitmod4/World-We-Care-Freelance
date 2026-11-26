/** "just now", "5m", "3h", "2d", then a short date. Input is an ISO string. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const s = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(then.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  });
}
