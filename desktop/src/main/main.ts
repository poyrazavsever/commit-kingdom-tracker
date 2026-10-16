import { hostname } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { DesktopApi, KeyRevoked, type Summary } from './api';
import { clearCliKey, cliKey, cliPaths, markAiStart, writeCliKey } from './cliConfig';
import { bundledCli, ensureCli } from './cliInstall';
import { apiUrl, appUrl, DEFAULT_API_URL, heartbeatApiUrl } from './config';
import { editorCandidates, type EditorId, findEditors, installExtension } from './editors';
import { forgetDevice, loadDevice, saveDevice } from './keyStore';
import { Mascot } from './mascot';
import { CHEER_MS, type Mood, moodOf, shouldCheer } from './mood';
import { loadSettings, saveSettings, type Settings } from './settings';
import { type Device, signIn, SignInCancelled } from './signIn';

/** What the window shows; the renderer only draws it (static/renderer.js). */
type View = {
  phase: 'signedOut' | 'waiting' | 'signedIn';
  locale: 'tr' | 'en';
  deviceName: string;
  summary: Summary | null;
  /** The VS Code family editors on this computer; null until they have been looked for. */
  editors: { id: EditorId; name: string; hasExtension: boolean; installing: boolean }[] | null;
  error: 'signIn' | 'offline' | 'keyStore' | 'rename' | 'install' | 'cli' | null;
};

const REFRESH_MS = 60_000;
/** Moods follow the clock between refreshes (watching → waiting → asleep). */
const MOOD_TICK_MS = 15_000;
const paths = cliPaths();
const mascot = new Mascot();

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let device: Device | null = null;
let signInAbort: AbortController | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let quitting = false;
let settings: Settings;
let cheerUntil = 0;
const view: View = { phase: 'signedOut', locale: 'en', deviceName: '', summary: null, editors: null, error: null };
/** Editors are looked for again when the window comes back, at most this often (each look starts every editor's CLI). */
const EDITORS_EVERY_MS = 2 * 60_000;
let editorsAt = 0;

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
  settings = loadSettings();
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  if (process.platform === 'darwin') app.dock?.hide();

  installCli();
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
  setInterval(updateMascot, MOOD_TICK_MS);
}

function registerIpc(): void {
  ipcMain.handle('state', () => view);
  ipcMain.handle('sign-in', () => startSignIn());
  ipcMain.handle('cancel-sign-in', () => signInAbort?.abort());
  ipcMain.handle('rename', (_event, name: unknown) => rename(typeof name === 'string' ? name : ''));
  ipcMain.handle('sign-out', () => signOut());
  ipcMain.handle('open-app', () => shell.openExternal(appUrl));
  ipcMain.handle('install-extension', (_event, id: unknown) => installInto(id));
  ipcMain.handle('install-all', () => installAll());
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
    installCli();
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

/** tudi-cli comes with Tudi Desktop; the copy the editors use is kept the same as the one in the app. */
function installCli(): void {
  const resources = app.isPackaged ? process.resourcesPath : join(__dirname, '..', '..', 'resources');
  try {
    if (ensureCli(bundledCli(resources), paths.cli) === 'missing') set({ error: 'cli' });
  } catch {
    set({ error: 'cli' });
  }
}

async function refreshEditors(force = false): Promise<void> {
  if (!force && Date.now() - editorsAt < EDITORS_EVERY_MS) return;
  editorsAt = Date.now();
  const found = await findEditors();
  const installing = new Set((view.editors ?? []).filter(editor => editor.installing).map(editor => editor.id));
  set({ editors: found.map(({ id, name, hasExtension }) => ({ id, name, hasExtension, installing: installing.has(id) })) });
}

/**
 * Every editor keeps its own extensions, so each needs the extension once; this does them one after another (two
 * editor installers at once can trip over the shared download cache).
 */
async function installAll(): Promise<void> {
  for (const editor of (view.editors ?? []).filter(item => !item.hasExtension && !item.installing)) await installInto(editor.id, false);
  await refreshEditors(true);
}

async function installInto(id: unknown, refreshAfter = true): Promise<void> {
  const editor = editorCandidates().find(candidate => candidate.id === id);
  if (!editor || !view.editors) return;
  const mark = (installing: boolean) => set({ editors: (view.editors ?? []).map(item => (item.id === editor.id ? { ...item, installing } : item)) });
  mark(true);
  try {
    await installExtension(editor);
    if (view.error === 'install') set({ error: null });
  } catch {
    set({ error: 'install' });
  }
  mark(false);
  if (refreshAfter) await refreshEditors(true);
}

async function refresh(): Promise<void> {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!device) return;
  try {
    const summary = await new DesktopApi(apiUrl, device.apiKey).summary();
    if (view.summary && shouldCheer(view.summary, summary)) cheerUntil = Date.now() + CHEER_MS;
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
  updateMascot();
}

/** Tudi stays on screen while this computer is signed in and the member has not hidden it. */
function updateMascot(): void {
  if (!settings) return;
  if (view.phase !== 'signedIn' || !settings.showMascot) return mascot.hide();
  const cheering = Date.now() < cheerUntil;
  const mood: Mood = cheering ? 'cheering' : moodOf(view.summary?.lastHeartbeatAt, new Date());
  if (cheering) setTimeout(updateMascot, cheerUntil - Date.now() + 20);
  const intro = !settings.mascotIntroSeen;
  mascot.show({ mood, intro, locale: view.locale });
  if (intro) {
    settings = { ...settings, mascotIntroSeen: true };
    saveSettings(settings);
  }
}

function toggleMascot(show: boolean): void {
  settings = { ...settings, showMascot: show };
  saveSettings(settings);
  updateMascot();
  updateTray();
}

function showWindow(): void {
  if (!window) {
    window = new BrowserWindow({
      // The content area itself (useContentSize): the frame and title bar never eat into it, so nothing scrolls.
      width: 820,
      height: 540,
      useContentSize: true,
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
    window.on('show', () => void refreshEditors());
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
    void refreshEditors(true);
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
      { label: tr ? 'Ekranda Tudi' : 'Tudi on screen', type: 'checkbox', checked: settings?.showMascot ?? true, enabled: view.phase === 'signedIn', click: item => toggleMascot(item.checked) },
      { type: 'separator' },
      { label: tr ? 'Çık' : 'Quit', click: () => app.quit() },
    ]),
  );
}

function iconPath(): string {
  return join(__dirname, '..', '..', 'assets', 'icon.png');
}
