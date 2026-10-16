import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

/** How often an installed Tudi Desktop looks for a new release on GitHub Releases. */
const CHECK_EVERY_MS = 6 * 60 * 60_000;

/**
 * Updates come from GitHub Releases (ADR-027) and bring the matching tudi-cli with them. A new version downloads in
 * the background and installs when Tudi Desktop quits; `onReady` lets the tray offer to restart now. Development
 * runs (not packaged) never update.
 */
export function startUpdates(onReady: (version: string) => void): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', info => onReady(info.version));
  autoUpdater.on('error', () => undefined);
  const check = () => void autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, CHECK_EVERY_MS);
}

export function restartToUpdate(): void {
  autoUpdater.quitAndInstall();
}
