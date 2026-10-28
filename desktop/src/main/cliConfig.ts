import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readIniValue, setIniValues } from './ini';

/**
 * Where tudi-cli looks (cli/pkg/ini): its config is `<home>/.tudi.cfg` and its own files live in `<home>/.tudi`,
 * where home is TUDI_HOME (then its resources are TUDI_HOME itself) or the user's home folder.
 */
export function cliPaths(env: NodeJS.ProcessEnv = process.env, home = homedir()) {
  const custom = env.TUDI_HOME || env.WAKATIME_HOME;
  const root = custom ? custom.replace(/^~(?=$|[\\/])/, home) : home;
  const resources = custom ? root : join(root, '.tudi');
  return {
    config: join(root, '.tudi.cfg'),
    resources,
    internal: join(resources, 'wakatime-internal.cfg'),
    cli: join(resources, process.platform === 'win32' ? 'tudi-cli.exe' : 'tudi-cli'),
  };
}

type Paths = ReturnType<typeof cliPaths>;

/**
 * Gives tudi-cli (and through it every editor plugin) this computer's key. A development API is written as api_url;
 * the production API is tudi-cli's default, so the line is removed.
 */
export function writeCliKey(paths: Paths, apiKey: string, apiUrl: string | null): void {
  update(paths.config, 'settings', { api_key: apiKey, api_url: apiUrl, hostname: machineId(paths) ?? `${MACHINE_PREFIX}${randomUUID()}` });
}

const MACHINE_PREFIX = 'ck-';

/**
 * This computer's own id, sent as the machine name (X-Machine-Name) instead of the system's host name: names like
 * “MacBook-Pro” repeat between people, and a machine seen sending for two accounts holds back raid energy (ADR-024
 * §13). It is made once, kept on sign-out, so signing in with another account here is still the same machine.
 */
export function machineId(paths: Paths): string | undefined {
  if (!existsSync(paths.config)) return undefined;
  const value = readIniValue(readFileSync(paths.config, 'utf8'), 'settings', 'hostname');
  return value?.startsWith(MACHINE_PREFIX) ? value : undefined;
}

/** On sign-out the key leaves the config; the member's other settings stay. */
export function clearCliKey(paths: Paths): void {
  if (existsSync(paths.config)) update(paths.config, 'settings', { api_key: null, api_url: null });
}

export function cliKey(paths: Paths): string | undefined {
  return existsSync(paths.config) ? readIniValue(readFileSync(paths.config, 'utf8'), 'settings', 'api_key') : undefined;
}

/**
 * AI tool logs are read from the sign-in on (cli/pkg/ai/tudi_lookback.go): nothing written before this computer was
 * signed in leaves it.
 */
export function markAiStart(paths: Paths, at: Date): void {
  mkdirSync(paths.resources, { recursive: true });
  update(paths.internal, 'internal', { ai_logs_last_parsed_at: at.toISOString() });
}

function update(file: string, section: string, values: Record<string, string | null>): void {
  const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
  // The config holds the device key: readable by this user only (ignored on Windows, where the profile is private).
  writeFileSync(file, setIniValues(text, section, values), { encoding: 'utf8', mode: 0o600 });
}
