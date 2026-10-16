import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type CliSettings = { cliPath: string; apiUrl: string; plugin: string };

/** tudi-cli: the configured path, then ~/.tudi/tudi-cli, then whatever is on PATH. */
export function findCli(configured: string): string {
  if (configured && existsSync(configured)) return configured;
  const name = process.platform === 'win32' ? 'tudi-cli.exe' : 'tudi-cli';
  const home = join(homedir(), '.tudi', name);
  return existsSync(home) ? home : name;
}

export function heartbeatArgs(file: string, isWrite: boolean, settings: CliSettings): string[] {
  const args = ['--entity', file, '--plugin', settings.plugin];
  if (isWrite) args.push('--write');
  if (settings.apiUrl) args.push('--api-url', settings.apiUrl);
  return args;
}

/**
 * Starts a heartbeat and does not wait for it: the editor never blocks on the CLI. Errors are swallowed; the CLI keeps
 * an offline queue and retries on its own.
 */
export function sendHeartbeat(file: string, isWrite: boolean, settings: CliSettings): void {
  try {
    const child = spawn(findCli(settings.cliPath), heartbeatArgs(file, isWrite, settings), { detached: false, stdio: 'ignore', windowsHide: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // No CLI yet: the status bar asks the user to install it.
  }
}

/** Runs a CLI command that answers on stdout (--today) with a time limit. */
export function runCli(args: string[], settings: CliSettings, timeoutMs = 30_000): Promise<string> {
  const all = settings.apiUrl ? [...args, '--api-url', settings.apiUrl] : args;
  return new Promise((resolve, reject) => {
    execFile(findCli(settings.cliPath), [...all, '--plugin', settings.plugin], { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message).trim()));
      else resolve(stdout.trim());
    });
  });
}
