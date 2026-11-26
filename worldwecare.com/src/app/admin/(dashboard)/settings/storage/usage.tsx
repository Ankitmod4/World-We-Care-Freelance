import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StorageSummary } from "@/lib/media";

/**
 * What is actually on disk.
 *
 * NO ORPHAN FIGURE HERE ANY MORE. This page used to show a
 * "Reclaimable" tile and a line telling you to run the sweeper, both
 * fed by `storageSummary`'s orphan count. Both are gone, and so is the
 * count — see the note in `storageSummary`, which no longer pays for a
 * whole-database reference scan on every load of this page.
 *
 * `npm run media:sweep` still reports exactly the same thing on the
 * server, which is where cleanup happens now.
 */

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function StorageUsage({ usage }: { usage: StorageSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
        <CardDescription>
          Files uploaded through the app. Deleting a post, article, event or clip now removes its
          media too.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Images & files" value={human(usage.totalBytes)} sub={`${usage.totalFiles} files`} />
          <Stat label="Converted video" value={human(usage.video.bytes)} sub={`${usage.video.count} videos`} />
          <Stat
            label="Total"
            value={human(usage.totalBytes + usage.video.bytes)}
            sub="on disk"
          />
        </div>

        {usage.byCategory.length > 0 && (
          <ul className="divide-y divide-[color:var(--color-border-soft)] rounded-[12px] border border-[color:var(--color-border-soft)]">
            {usage.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between px-3 py-2 text-[13px]">
                <span className="font-medium capitalize">{c.category}</span>
                <span className="tabular-nums text-[color:var(--color-text-muted)]">
                  {c.files} file{c.files === 1 ? "" : "s"} · {human(c.bytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-[12px] border border-[color:var(--color-border-soft)] p-3">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-[color:var(--color-text-subtle)]">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-[-0.01em]">
        {value}
      </p>
      <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">{sub}</p>
    </div>
  );
}
