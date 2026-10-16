import { hostname } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { DesktopApi, KeyRevoked, type Summary } from './api';
import { clearCliKey, cliKey, cliPaths, markAiStart, writeCliKey } from './cliConfig';
import { apiUrl, appUrl, DEFAULT_API_URL, heartbeatApiUrl } from './config';
import { forgetDevice, loadDevice, saveDevice } from './keyStore';
import { type Device, signIn, SignInCancelled } from './signIn';

/** What the window shows; the renderer only draws it (static/renderer.js). */
type View = {
  phase: 'signedOut' | 'waiting' | 'signedIn';
  locale: 'tr' | 'en';
  deviceName: string;
  summary: Summary | null;
  error: 'signIn' | 'offline' | 'keyStore' | 'rename' | null;
};

const REFRESH_MS = 60_000;
const paths = cliPaths();

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let device: Device | null = null;
let signInAbort: AbortController | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let quitting = false;
const view: View = { phase: 'signedOut', locale: 'en', deviceName: '', summary: null, error: null };

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(start);
  app.on('before-quit', () => {
    quitting = true;
  });
  // Tudi Desktop lives in the tray: closing the window does not quit it.
  app.on('window-all-closed', () => undefined);
}

function start(): void {
  view.locale = app.getLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en';
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  if (process.platform === 'darwin') app.dock?.hide();

  device = loadDevice();
  if (device) {
    // The key lives here; tudi-cli's copy is put back if the member deleted or edited the config.
    if (cliKey(paths) !== device.apiKey) writeCliKey(paths, device.apiKey, cliApiUrl());
    set({ phase: 'signedIn', deviceName: device.name });
    void refresh();
  }

  registerIpc();
  createTray();
  showWindow();
}

function registerIpc(): void {
  ipcMain.handle('state', () => view);
  ipcMain.handle('sign-in', () => startSignIn());
  ipcMain.handle('cancel-sign-in', () => signInAbort?.abort());
  ipcMain.handle('rename', (_event, name: unknown) => rename(typeof name === 'string' ? name : ''));
  ipcMain.handle('sign-out', () => signOut());
  ipcMain.handle('open-app', () => shell.openExternal(appUrl));
}

async function startSignIn(): Promise<void> {
  if (view.phase !== 'signedOut') return;
  signInAbort = new AbortController();
  set({ phase: 'waiting', error: null });
  const tr = view.locale === 'tr';
  try {
    const signed = await signIn({
      apiUrl,
      appUrl,
      deviceName: hostname(),
      signal: signInAbort.signal,
      openBrowser: url => shell.openExternal(url),
      pages: tr
        ? { done: 'Bu bilgisayar bağlandı. Tudi Desktop’a dönebilirsin.', cancelled: 'Giriş iptal edildi.', failed: 'Bu bağlantı artık geçerli değil.' }
        : { done: 'This computer is signed in. You can go back to Tudi Desktop.', cancelled: 'Sign-in was cancelled.', failed: 'This link is no longer valid.' },
    });
    saveDevice(signed);
    writeCliKey(paths, signed.apiKey, cliApiUrl());
    markAiStart(paths, new Date());
    device = signed;
    set({ phase: 'signedIn', deviceName: signed.name, summary: null });
    showWindow();
    void refresh();
  } catch (error) {
    const keyStore = error instanceof Error && /key store/.test(error.message);
    set({ phase: 'signedOut', error: error instanceof SignInCancelled ? null : keyStore ? 'keyStore' : 'signIn' });
  } finally {
    signInAbort = null;
  }
}

async function refresh(): Promise<void> {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!device) return;
  try {
    const summary = await new DesktopApi(apiUrl, device.apiKey).summary();
    if (summary.deviceName !== device.name) {
      device = { ...device, name: summary.deviceName };
      saveDevice(device);
    }
    set({ summary, deviceName: summary.deviceName, error: view.error === 'offline' ? null : view.error });
  } catch (error) {
    if (error instanceof KeyRevoked) return forgetLocally();
    set({ error: 'offline' });
  }
  refreshTimer = setTimeout(() => void refresh(), REFRESH_MS);
}

async function rename(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 48);
  if (!device || !trimmed || trimmed === device.name) return;
  try {
    await new DesktopApi(apiUrl, device.apiKey).rename(trimmed);
    device = { ...device, name: trimmed };
    saveDevice(device);
    set({ deviceName: trimmed, error: null });
  } catch (error) {
    if (error instanceof KeyRevoked) return forgetLocally();
    set({ error: 'rename' });
  }
}

async function signOut(): Promise<void> {
  if (!device) return;
  try {
    await new DesktopApi(apiUrl, device.apiKey).signOut();
  } catch {
    // Offline: the key is still dropped here; the member can remove the computer from the app's Code Tower.
  }
  forgetLocally();
}

function forgetLocally(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  device = null;
  forgetDevice();
  clearCliKey(paths);
  set({ phase: 'signedOut', deviceName: '', summary: null, error: null });
}

/** tudi-cli defaults to the production API; only a development API is written to its config. */
function cliApiUrl(): string | null {
  return apiUrl === DEFAULT_API_URL ? null : heartbeatApiUrl(apiUrl);
}

function set(change: Partial<View>): void {
  Object.assign(view, change);
  window?.webContents.send('state', view);
  updateTray();
}

function showWindow(): void {
  if (!window) {
    window = new BrowserWindow({
      width: 380,
      height: 600,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'Tudi Desktop',
      icon: iconPath(),
      autoHideMenuBar: true,
      webPreferences: { preload: join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    window.removeMenu();
    window.loadFile(join(__dirname, '..', '..', 'static', 'index.html'));
    window.once('ready-to-show', () => window?.show());
    window.on('close', event => {
      if (quitting) return;
      event.preventDefault();
      window?.hide();
    });
    // Links never open inside the app.
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', event => event.preventDefault());
    return;
  }
  window.show();
  window.focus();
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 }));
  tray.setToolTip('Tudi Desktop');
  tray.on('click', showWindow);
  updateTray();
}

function updateTray(): void {
  if (!tray) return;
  const tr = view.locale === 'tr';
  const minutes = Math.floor(view.summary?.today.weightedMinutes ?? 0);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: view.phase === 'signedIn' ? (tr ? `Bugün ${minutes} dk` : `Today ${minutes} min`) : tr ? 'Giriş yapılmadı' : 'Not signed in', enabled: false },
      { type: 'separator' },
      { label: tr ? 'Tudi Desktop’ı aç' : 'Open Tudi Desktop', click: showWindow },
      { label: tr ? 'Tudi Daily’yi aç' : 'Open Tudi Daily', click: () => void shell.openExternal(appUrl) },
      { type: 'separator' },
      { label: tr ? 'Çık' : 'Quit', click: () => app.quit() },
    ]),
  );
}

function iconPath(): string {
  return join(__dirname, '..', '..', 'assets', 'icon.png');
}
