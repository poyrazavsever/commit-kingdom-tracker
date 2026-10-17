import { execFile } from 'node:child_process';

/**
 * tudi-cli sends to the API at most every two minutes and keeps what comes in between in its offline queue
 * (wakatime-cli's rate limit). When the member stops coding no heartbeat comes to send that queue, so the last minutes
 * would wait for the next coding session. Tudi Desktop sends it as often as tudi-cli itself would.
 */
export const SYNC_EVERY_MS = 2 * 60_000;

export type RunCli = (file: string, args: string[], timeoutMs: number) => Promise<void>;

const runCli: RunCli = (file, args, timeoutMs) =>
  new Promise(resolve => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true }, () => resolve());
  });

/** Starts `tudi-cli --sync-offline-activity`; an empty queue sends nothing. Failures are left to the next try. */
export function syncQueue(cli: string, plugin: string, run: RunCli = runCli): Promise<void> {
  return run(cli, ['--sync-offline-activity', '1000', '--plugin', plugin], 60_000);
}

/** Whether it is time to send the queue again. */
export function syncDue(lastSyncAt: number, now: number): boolean {
  return now - lastSyncAt >= SYNC_EVERY_MS;
}
