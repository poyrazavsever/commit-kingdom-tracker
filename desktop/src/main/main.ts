import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, shell, Tray } from 'electron';
import { type AiTool, findAiTools } from './aiTools';
import { DesktopApi, type DesktopPlus, KeyRevoked, type Summary } from './api';
import { clearCliKey, cliKey, cliPaths, machineId, markAiStart, writeCliKey } from './cliConfig';
import { bundledCli, ensureCli } from './cliInstall';
import { apiUrl, appUrl, DEFAULT_API_URL, heartbeatApiUrl } from './config';
import { editorIcon } from './editorIcons';
import { editorCandidates, extensionSource, findEditors, installExtension } from './editors';
import { findJetBrainsIdes, installPlugin, pluginSource } from './jetbrains';
import { findVisualStudios, installVsix, vsixSource } from './visualStudio';
import { forgetDevice, loadDevice, saveDevice } from './keyStore';
import { syncAi, syncDue, syncQueue } from './queue';
import { restartToUpdate, startUpdates } from './updater';
import { defaultDeviceName, type Device, signIn, SignInCancelled } from './signIn';

/** What the window shows; the renderer only draws it (static/renderer.js). */
type View = {
  phase: 'signedOut' | 'waiting' | 'signedIn';
  locale: 'tr' | 'en';
  deviceName: string;
  summary: Summary | null;
  /**
   * The VS Code family editors and JetBrains IDEs on this computer; null until they have been looked for. `restart`:
   * a JetBrains IDE loads the plugin the next time it starts.
   */
  editors: { id: string; name: string; icon: string | null; hasExtension: boolean; installing: boolean; restart: boolean }[] | null;
  /** AI coding tools with logs on this computer; their work counts without an editor (queue.ts → syncAi). */
  aiTools: AiTool[];
  /** Whether the member has Kingdom Plus (the Kingdom Plus page). */
  plus: DesktopPlus | null;
  error: 'signIn' | 'offline' | 'keyStore' | 'rename' | 'install' | 'cli' | null;
  /** Increments even when the same error happens twice, so every event gets its own toast. */
  errorId: number;
};

const REFRESH_MS = 60_000;
const paths = cliPaths();

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let device: Device | null = null;
let signInAbort: AbortController | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let quitting = false;
/** A downloaded update waiting for a restart. */
let updateReady: string | null = null;
const view: View = { phase: 'signedOut', locale: 'en', deviceName: '', summary: null, editors: null, aiTools: [], plus: null, error: null, errorId: 0 };
/** Editors are looked for again when the window comes back, at most this often (each look starts every editor's CLI). */
const EDITORS_EVERY_MS = 2 * 60_000;
let editorsAt = 0;
/** JetBrains IDEs given the plugin in this run: they show a restart note. */
const restartIds = new Set<string>();
/** When tudi-cli's offline queue was last sent (queue.ts). */
let syncedAt = 0;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(start);
  app.on('before-quit', () => {
    quitting = true;
  });
  // Commit Kingdom Desktop lives in the tray: closing the window does not quit it.
  app.on('window-all-closed', () => undefined);
}

function start(): void {
  view.locale = app.getLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en';
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  if (process.platform === 'darwin') app.dock?.hide();

  installCli();
  device = loadDevice();
  if (device) {
    // The key lives here; tudi-cli's copy is put back if the member deleted or edited the config, and computers
    // signed in before the machine id existed get one.
    if (cliKey(paths) !== device.apiKey || !machineId(paths)) writeCliKey(paths, device.apiKey, cliApiUrl());
    set({ phase: 'signedIn', deviceName: device.name });
    void refresh();
  }

  registerIpc();
  createTray();
  // A computer that slept missed its two-minute syncs: what the agents and editors did before sleep goes out now.
  powerMonitor.on('resume', () => {
    syncedAt = 0;
    void refresh();
  });
  showWindow();
  startUpdates(version => {
    updateReady = version;
    updateTray();
  });
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
  ipcMain.handle('open-link', (_event, target: unknown) => {
    const url = typeof target === 'string' ? links[target] : undefined;
    if (url) void shell.openExternal(url);
  });
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
      deviceName: defaultDeviceName(process.platform, tr),
      signal: signInAbort.signal,
      openBrowser: url => shell.openExternal(url),
      pages: tr
        ? { done: 'Bu bilgisayar bağlandı. Commit Kingdom Desktop’a dönebilirsin.', cancelled: 'Giriş iptal edildi.', failed: 'Bu bağlantı artık geçerli değil.' }
        : { done: 'This computer is signed in. You can go back to Commit Kingdom Desktop.', cancelled: 'Sign-in was cancelled.', failed: 'This link is no longer valid.' },
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
    set({ phase: 'signedOut', error: null });
    if (!(error instanceof SignInCancelled)) fail(keyStore ? 'keyStore' : 'signIn');
  } finally {
    signInAbort = null;
  }
}

/** tudi-cli comes with Commit Kingdom Desktop; the copy the editors use is kept the same as the one in the app. */
function installCli(): void {
  const resources = app.isPackaged ? process.resourcesPath : join(__dirname, '..', '..', 'resources');
  try {
    if (ensureCli(bundledCli(resources), paths.cli) === 'missing') fail('cli');
  } catch {
    fail('cli');
  }
}

async function refreshEditors(force = false): Promise<void> {
  if (!force && Date.now() - editorsAt < EDITORS_EVERY_MS) return;
  editorsAt = Date.now();
  const found = [
    ...(await findEditors()).map(({ id, name, app, hasExtension }) => ({ id: id as string, name, app, hasExtension })),
    ...findJetBrainsIdes().map(({ id, name, app, hasPlugin }) => ({ id: id as string, name, app, hasExtension: hasPlugin })),
    // Visual Studio is listed only when Desktop carries its extension (it is not on the Marketplace yet).
    ...(visualStudioVsix() ? (await findVisualStudios()).map(({ id, name, app, hasExtension }) => ({ id: id as string, name, app, hasExtension })) : []),
  ];
  const installing = new Set((view.editors ?? []).filter(editor => editor.installing).map(editor => editor.id));
  const icons = await Promise.all(found.map(editor => editorIcon(editor.app)));
  set({
    aiTools: findAiTools(),
    editors: found.map(({ id, name, hasExtension }, index) => ({
      id,
      name,
      icon: icons[index],
      hasExtension,
      installing: installing.has(id),
      restart: hasExtension && restartIds.has(id),
    })),
  });
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
  const ide = findJetBrainsIdes().find(candidate => candidate.id === id);
  const vs = typeof id === 'string' && id.startsWith('visualstudio-') ? (await findVisualStudios()).find(candidate => candidate.id === id) : undefined;
  if ((!editor && !ide && !vs) || !view.editors) return;
  const mark = (installing: boolean) => set({ editors: (view.editors ?? []).map(item => (item.id === id ? { ...item, installing } : item)) });
  mark(true);
  try {
    if (editor) {
      const developmentVsix = join(__dirname, '..', '..', '..', 'vscode', 'tudi-tracker.vsix');
      await installExtension(editor, undefined, extensionSource(process.resourcesPath, developmentVsix));
    } else if (ide) {
      await installPlugin(ide, pluginSource(process.resourcesPath, join(__dirname, '..', '..', '..', 'jetbrains', 'build', 'distributions')));
      restartIds.add(ide.id);
    } else if (vs) {
      const vsix = visualStudioVsix();
      if (!vsix) throw new Error('No Visual Studio extension in this build.');
      await installVsix(vs, vsix);
      restartIds.add(vs.id);
    }
    if (view.error === 'install') set({ error: null });
  } catch (error) {
    const name = editor?.name ?? ide?.name ?? vs?.name ?? String(id);
    console.error(`Could not install Tudi Tracker in ${name}:`, error);
    fail('install');
  }
  mark(false);
  if (refreshAfter) await refreshEditors(true);
}

function visualStudioVsix(): string | null {
  return vsixSource(process.resourcesPath, join(__dirname, '..', '..', '..', 'visualstudio', 'bin', 'Release', 'CommitKingdom.VisualStudio.vsix'));
}

/** The only page the window opens besides the app: the site's Kingdom Plus page in the member's language. */
const links: Record<string, string> = {
  get plus() {
    return `https://commitkingdom.com${view.locale === 'en' ? '/en' : ''}/plus`;
  },
};

async function refresh(): Promise<void> {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!device) return;
  if (syncDue(syncedAt, Date.now())) {
    syncedAt = Date.now();
    const plugin = `tudi-desktop/${app.getVersion()}`;
    // The agents' work first: anything it puts in the offline queue then leaves with the queue.
    await syncAi(paths.cli, plugin);
    await syncQueue(paths.cli, plugin);
  }
  try {
    const summary = await new DesktopApi(apiUrl, device.apiKey).summary();
    if (summary.deviceName !== device.name) {
      device = { ...device, name: summary.deviceName };
      saveDevice(device);
    }
    const api = new DesktopApi(apiUrl, device.apiKey);
    // Plus is an extra: if it fails (an older API, a hiccup) the window keeps what it had.
    const plus = await api.plus().catch(error => (error instanceof KeyRevoked ? Promise.reject(error) : view.plus));
    set({ summary, plus, deviceName: summary.deviceName, error: view.error === 'offline' ? null : view.error });
  } catch (error) {
    if (error instanceof KeyRevoked) return forgetLocally();
    if (view.error !== 'offline') fail('offline');
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
    fail('rename');
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
  set({ phase: 'signedOut', deviceName: '', summary: null, plus: null, error: null });
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

function fail(error: NonNullable<View['error']>): void {
  set({ error, errorId: view.errorId + 1 });
}

function showWindow(): void {
  if (!window) {
    window = new BrowserWindow({
      // The content area itself (useContentSize): the frame and title bar never eat into it, so nothing scrolls.
      width: 980,
      height: 640,
      useContentSize: true,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'Commit Kingdom Desktop',
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
  tray.setToolTip('Commit Kingdom Desktop');
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
      { label: tr ? 'Commit Kingdom Desktop’ı aç' : 'Open Commit Kingdom Desktop', click: showWindow },
      { label: tr ? 'Commit Kingdom’ı aç' : 'Open Commit Kingdom', click: () => void shell.openExternal(appUrl) },
      { type: 'separator' },
      ...(updateReady
        ? [{ label: tr ? `Güncelle ve yeniden başlat (${updateReady})` : `Restart to update (${updateReady})`, click: restartToUpdate }, { type: 'separator' as const }]
        : []),
      { label: tr ? 'Çık' : 'Quit', click: () => app.quit() },
    ]),
  );
}

function iconPath(): string {
  return join(__dirname, '..', '..', 'assets', 'icon.png');
}
