import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

/** The member's own choices; nothing secret lives here. */
export type Settings = { showMascot: boolean; mascotIntroSeen: boolean };

const defaults: Settings = { showMascot: false, mascotIntroSeen: false };
const file = () => join(app.getPath('userData'), 'settings.json');

export function loadSettings(): Settings {
  try {
    return existsSync(file()) ? { ...defaults, ...(JSON.parse(readFileSync(file(), 'utf8')) as Partial<Settings>) } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Settings): void {
  writeFileSync(file(), JSON.stringify(settings, null, 2));
}
