import { join } from 'node:path';
import { BrowserWindow, screen } from 'electron';
import type { Mood } from './mood';

const WIDTH = 240;
const HEIGHT = 260;
const MARGIN = 12;

export type MascotView = { mood: Mood; intro: boolean; locale: 'tr' | 'en' };

/**
 * The always-on-top Tudi: a small transparent window above the taskbar at the bottom right of the primary screen. It
 * never takes focus and every click passes through it to whatever is underneath.
 */
export class Mascot {
  private window: BrowserWindow | null = null;
  private view: MascotView | null = null;
  /** The hello bubble waits until a loaded window has actually received it. */
  private introPending = false;

  show(view: MascotView): void {
    this.view = view;
    if (view.intro) this.introPending = true;
    if (!this.window) this.create();
    else this.send();
  }

  hide(): void {
    this.window?.destroy();
    this.window = null;
  }

  private create(): void {
    const window = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: { preload: join(__dirname, '..', 'mascotPreload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false },
    });
    window.setAlwaysOnTop(true, 'floating');
    window.setIgnoreMouseEvents(true);
    if (process.platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.loadFile(join(__dirname, '..', '..', 'static', 'mascot.html'));
    window.webContents.once('did-finish-load', () => {
      this.place();
      this.send();
      window.showInactive();
    });
    screen.on('display-metrics-changed', this.place);
    window.on('closed', () => screen.off('display-metrics-changed', this.place));
    this.window = window;
  }

  private place = (): void => {
    const area = screen.getPrimaryDisplay().workArea;
    this.window?.setBounds({ x: area.x + area.width - WIDTH - MARGIN, y: area.y + area.height - HEIGHT, width: WIDTH, height: HEIGHT });
  };

  private send(): void {
    if (!this.window || !this.view || this.window.webContents.isLoading()) return;
    this.window.webContents.send('mascot', { ...this.view, intro: this.introPending });
    this.introPending = false;
  }
}
