/**
 * Send the daily digest to whoever is due one.
 *
 * THIS PROJECT HAS NO SCHEDULER. Nothing runs this for you. Wire it to
 * cron or a systemd timer on the box that runs the app:
 *
 *   # every hour, on the hour
 *   0 * * * * cd /path/to/world && /usr/bin/npx tsx prisma/send-digests.ts >> /var/log/wwc-digest.log 2>&1
 *
 * Run it HOURLY, not daily. Members pick their own hour in their own
 * timezone, so the job has to come round often enough to catch each of
 * them; it sends to nobody the other twenty-three times.
 *
 *   npm run digest:dry     select and build, send nothing
 *   npm run digest:send    the real thing
 *
 * SAFE TO RUN TWICE. The local send-date is claimed before the email
 * goes out, so overlapping runs cannot double-send. A run that misses
 * its hour catches nobody up — a digest is a morning thing and an
 * afternoon copy of it is just noise.
 *
 * Requires APP_URL in the environment, or the links in the email will
 * be relative to nothing.
 */

import { runDigest } from "../src/lib/digest";

const dry = process.argv.includes("--dry-run");

async function main() {
  if (!process.env.APP_URL) {
    console.warn("APP_URL is not set — links in the email will be broken.");
  }

  const started = Date.now();
  const res = await runDigest({ dryRun: dry });
  const ms = Date.now() - started;

  console.log(
    `${dry ? "[dry run] " : ""}due ${res.considered} · sent ${res.sent} · skipped ${res.skipped} · failed ${res.failed}  (${ms}ms)`,
  );
  if (res.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
