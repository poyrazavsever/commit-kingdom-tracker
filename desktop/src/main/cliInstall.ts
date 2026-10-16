import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export type CliInstall = 'installed' | 'updated' | 'current' | 'missing';

/**
 * Tudi Desktop carries the tudi-cli binary for its own platform (`resources/bin/<platform>-<arch>/`), signed with the
 * app, so a Tudi Desktop update is also a tudi-cli update (ADR-027 §4). In development it is built by
 * `npm run build:cli`.
 */
export function bundledCli(resourcesRoot: string, platform: NodeJS.Platform = process.platform, arch: string = process.arch): string {
  return join(resourcesRoot, 'bin', `${platform}-${arch}`, platform === 'win32' ? 'tudi-cli.exe' : 'tudi-cli');
}

/**
 * Puts the bundled tudi-cli at `target` (~/.tudi/tudi-cli, where the editor plugins look) when it is missing or
 * differs. The swap never leaves a half-written binary: the new file is copied beside it first. A running tudi-cli
 * keeps its file open on Windows, which may be renamed but not deleted, so the old one is moved aside and removed
 * when it can be.
 */
export function ensureCli(bundled: string, target: string): CliInstall {
  if (!existsSync(bundled)) return 'missing';
  const existed = existsSync(target);
  if (existed && sameFile(bundled, target)) return 'current';

  mkdirSync(join(target, '..'), { recursive: true });
  const fresh = `${target}.new`;
  const old = `${target}.old`;
  copyFileSync(bundled, fresh);
  if (process.platform !== 'win32') chmodSync(fresh, 0o755);
  rmSync(old, { force: true });
  if (existed) renameSync(target, old);
  renameSync(fresh, target);
  try {
    rmSync(old, { force: true });
  } catch {
    // Still running; the next install removes it.
  }
  return existed ? 'updated' : 'installed';
}

function sameFile(a: string, b: string): boolean {
  const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
  return digest(a) === digest(b);
}
