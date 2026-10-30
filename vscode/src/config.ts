import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where Tudi Desktop gets the extension and the computer signed in (ADR-027). */
export const SETUP_URL = 'https://commitkingdom.com/tracker';

/** tudi-cli's config, written by Tudi Desktop: `<TUDI_HOME or home>/.tudi.cfg` (cli/pkg/ini). */
export function configPath(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const custom = env.TUDI_HOME || env.WAKATIME_HOME;
  return join(custom ? custom.replace(/^~(?=$|[\\/])/, home) : home, '.tudi.cfg');
}

/**
 * Whether Tudi Desktop has signed this computer in. The extension only checks that a key is there; it never reads it
 * into the editor, tudi-cli does that itself.
 */
export function isSignedIn(file = configPath()): boolean {
  if (!existsSync(file)) return false;
  let inSettings = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header) inSettings = header[1].trim().toLowerCase() === 'settings';
    else if (inSettings && /^\s*api_key\s*=\s*\S+/i.test(line)) return true;
  }
  return false;
}
