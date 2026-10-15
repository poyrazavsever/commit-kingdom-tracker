/** Two minutes: how often a file that keeps changing is reported (the same rhythm as WakaTime plugins). */
export const REPEAT_MS = 2 * 60 * 1000;

/**
 * Decides when a change becomes a heartbeat: a save always does, switching to another file does, and typing in the
 * same file does once every two minutes. Keeps the CLI from starting on every keystroke.
 */
export class HeartbeatGate {
  private lastFile: string | null = null;
  private lastAt = 0;

  shouldSend(file: string, isWrite: boolean, now: number): boolean {
    const send = isWrite || file !== this.lastFile || now - this.lastAt >= REPEAT_MS;
    if (send) {
      this.lastFile = file;
      this.lastAt = now;
    }
    return send;
  }
}
