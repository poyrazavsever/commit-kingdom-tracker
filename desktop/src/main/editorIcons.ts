import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { app, nativeImage } from 'electron';

const run = promisify(execFile);

/**
 * Each editor's own logo, taken from the installed editor: no editor logo ships with Tudi Desktop. On Windows the
 * VS Code family keeps a 150 px logo for its Start tile (resources\app\resources\win32, inside a version folder
 * for VS Code itself); without one, the .exe's icon. On macOS, the .icns the .app names in its Info.plist.
 */
const iconCache = new Map<string, string | null>();
export async function editorIcon(path: string): Promise<string | null> {
  if (!iconCache.has(path)) {
    let icon: string | null = null;
    try {
      const image = process.platform === 'darwin' ? await bundleIcon(path) : await windowsIcon(path);
      icon = !image || image.isEmpty() ? null : trimTransparent(image).resize({ width: 64, quality: 'best' }).toDataURL();
    } catch {
      icon = null;
    }
    iconCache.set(path, icon);
  }
  return iconCache.get(path) ?? null;
}

async function windowsIcon(exe: string): Promise<Electron.NativeImage> {
  const tile = process.platform === 'win32' ? startTile(dirname(exe)) : undefined;
  return tile ? nativeImage.createFromPath(tile) : app.getFileIcon(exe, { size: 'large' });
}

/**
 * Never app.getFileIcon on macOS: Chromium reads the icon on a worker thread (IconLoader::ReadIcon) and that crashes
 * the whole app on macOS a few seconds after it opens. The .icns is turned into a PNG with the system's sips instead.
 */
async function bundleIcon(bundle: string): Promise<Electron.NativeImage | null> {
  const contents = join(bundle, 'Contents');
  const { stdout } = await run('/usr/bin/plutil', ['-extract', 'CFBundleIconFile', 'raw', '-o', '-', join(contents, 'Info.plist')]);
  const name = stdout.trim();
  if (!name) return null;
  const icns = join(contents, 'Resources', name.endsWith('.icns') ? name : `${name}.icns`);
  if (!existsSync(icns)) return null;
  const dir = mkdtempSync(join(tmpdir(), 'ck-icon-'));
  try {
    const png = join(dir, 'icon.png');
    await run('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '256', icns, '--out', png]);
    return nativeImage.createFromPath(png);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Crops the transparent margin around a logo (VS Code's tile logo fills only the middle of its 150 px). */
function trimTransparent(image: Electron.NativeImage): Electron.NativeImage {
  const { width, height } = image.getSize();
  const pixels = image.toBitmap();
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return image;
  // Keep it square, centred on the logo.
  const side = Math.max(right - left, bottom - top) + 1;
  const x = Math.max(0, Math.min(width - side, Math.round((left + right + 1 - side) / 2)));
  const y = Math.max(0, Math.min(height - side, Math.round((top + bottom + 1 - side) / 2)));
  return image.crop({ x, y, width: Math.min(side, width), height: Math.min(side, height) });
}

function startTile(install: string): string | undefined {
  const tile = (root: string) => join(root, 'resources', 'app', 'resources', 'win32', 'code_150x150.png');
  if (existsSync(tile(install))) return tile(install);
  try {
    return readdirSync(install, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => tile(join(install, entry.name)))
      .find(path => existsSync(path));
  } catch {
    return undefined;
  }
}
