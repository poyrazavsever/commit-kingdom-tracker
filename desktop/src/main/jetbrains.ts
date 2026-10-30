import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** The plugin's id in plugin.xml and on JetBrains Marketplace. */
export const PLUGIN_ID = 'com.tudidaily.tracker';
/** The folder the plugin zip unpacks to (jetbrains/build.gradle.kts → rootProject.name). */
export const PLUGIN_FOLDER = 'tudi-tracker-jetbrains';
/** The plugin supports 2024.2 and later (jetbrains/gradle.properties → sinceBuild 242). */
const OLDEST = [2024, 2] as const;

/** Product folder prefixes and the names people know them by. */
const PRODUCTS: Record<string, string> = {
  IntelliJIdea: 'IntelliJ IDEA',
  IdeaIC: 'IntelliJ IDEA CE',
  PyCharm: 'PyCharm',
  PyCharmCE: 'PyCharm CE',
  WebStorm: 'WebStorm',
  PhpStorm: 'PhpStorm',
  GoLand: 'GoLand',
  Rider: 'Rider',
  CLion: 'CLion',
  RubyMine: 'RubyMine',
  RustRover: 'RustRover',
  DataGrip: 'DataGrip',
  DataSpell: 'DataSpell',
  AndroidStudio: 'Android Studio',
};

export type JetBrainsIde = {
  id: `jetbrains-${string}`;
  name: string;
  /** Where the IDE loads plugins from: `<config>/plugins`. */
  pluginsDir: string;
  /** The IDE's launcher, for its icon. */
  app: string;
  hasPlugin: boolean;
};

type Roots = { config: string[]; system: string[] };

/**
 * JetBrains IDEs (and Android Studio, which is one) keep a config folder per product and version, e.g.
 * `%APPDATA%\JetBrains\PyCharm2025.1` or `%APPDATA%\Google\AndroidStudio2025.2.2`, with the plugins inside. The matching
 * system folder holds `.home`, the IDE's install folder, which tells an IDE still installed from one left behind by an
 * uninstall or an upgrade.
 */
export function ideRoots(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): Roots {
  if (platform === 'win32') {
    const roaming = env.APPDATA ?? join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
    return { config: [join(roaming, 'JetBrains'), join(roaming, 'Google')], system: [join(local, 'JetBrains'), join(local, 'Google')] };
  }
  if (platform === 'darwin') {
    const support = join(home, 'Library', 'Application Support');
    const caches = join(home, 'Library', 'Caches');
    return { config: [join(support, 'JetBrains'), join(support, 'Google')], system: [join(caches, 'JetBrains'), join(caches, 'Google')] };
  }
  return { config: [], system: [] };
}

/** Splits a config folder name such as `PyCharm2025.1` or `AndroidStudio2025.2.2` into product and version. */
export function parseFolder(folder: string): { product: string; version: number[] } | null {
  const match = /^([A-Za-z]+?)(\d{4})\.(\d+)(?:\.(\d+))?$/.exec(folder);
  if (!match || !(match[1] in PRODUCTS)) return null;
  return { product: match[1], version: match.slice(2).filter(Boolean).map(Number) };
}

function newer(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

/** The newest installed version of each JetBrains IDE that the plugin supports. */
export function findJetBrainsIdes(roots: Roots = ideRoots(), platform: NodeJS.Platform = process.platform): JetBrainsIde[] {
  const newest = new Map<string, { version: number[]; config: string; folder: string; home: string }>();
  roots.config.forEach((configRoot, index) => {
    if (!existsSync(configRoot)) return;
    for (const folder of readdirSync(configRoot)) {
      const parsed = parseFolder(folder);
      if (!parsed || newer([...OLDEST], parsed.version)) continue;
      const home = installFolder(join(roots.system[index], folder));
      if (!home) continue;
      const current = newest.get(parsed.product);
      if (!current || newer(parsed.version, current.version)) newest.set(parsed.product, { version: parsed.version, config: join(configRoot, folder), folder, home });
    }
  });
  // By name, so the window lists them the same way every time.
  return [...newest.entries()].sort(([a], [b]) => PRODUCTS[a].localeCompare(PRODUCTS[b])).map(([product, found]) => {
    const pluginsDir = join(found.config, 'plugins');
    return {
      id: `jetbrains-${product.toLowerCase()}` as const,
      name: PRODUCTS[product],
      pluginsDir,
      app: launcher(found.home, platform),
      hasPlugin: existsSync(join(pluginsDir, PLUGIN_FOLDER)),
    };
  });
}

/** The install folder recorded in the system folder's `.home`, when that folder still exists. */
function installFolder(systemDir: string): string | null {
  try {
    const home = readFileSync(join(systemDir, '.home'), 'utf8').trim();
    return home && existsSync(home) ? home : null;
  } catch {
    return null;
  }
}

/** Windows: `bin\<name>64.exe` (idea64, pycharm64, studio64…); macOS: the .app. */
function launcher(home: string, platform: NodeJS.Platform): string {
  if (platform === 'darwin') return home.includes('.app') ? home.slice(0, home.indexOf('.app') + 4) : home;
  try {
    const exe = readdirSync(join(home, 'bin')).find(file => /^[a-z]+64\.exe$/i.test(file));
    return exe ? join(home, 'bin', exe) : home;
  } catch {
    return home;
  }
}

export type Extract = (zip: string, into: string) => Promise<void>;

/** Windows 10+ and macOS ship bsdtar, which unpacks zip files. */
const extractZip: Extract = (zip, into) =>
  new Promise((resolve, reject) => {
    execFile(process.platform === 'win32' ? 'tar.exe' : 'tar', ['-xf', zip, '-C', into], { timeout: 120_000, windowsHide: true }, error =>
      error ? reject(error) : resolve(),
    );
  });

/** The plugin's zip from JetBrains Marketplace (latest version for the 2024.2 line and later). */
export const MARKETPLACE_URL = `https://plugins.jetbrains.com/pluginManager?action=download&id=${PLUGIN_ID}&build=IC-242.0`;

async function download(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`plugin download failed: ${response.status}`);
  const file = join(tmpdir(), `${PLUGIN_FOLDER}-${Date.now()}.zip`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

/**
 * Packaged Desktop carries the plugin zip, as it carries the VSIX, so one click works before the plugin is on JetBrains
 * Marketplace; a local build uses jetbrains/build/distributions when it is there. TUDI_JETBRAINS_ZIP overrides both.
 */
export function pluginSource(resources: string, developmentDistributions: string, env: NodeJS.ProcessEnv = process.env): string {
  if (env.TUDI_JETBRAINS_ZIP) return env.TUDI_JETBRAINS_ZIP;
  const bundled = join(resources, 'extensions', `${PLUGIN_FOLDER}.zip`);
  if (existsSync(bundled)) return bundled;
  try {
    const built = readdirSync(developmentDistributions).filter(name => name.startsWith(PLUGIN_FOLDER) && name.endsWith('.zip')).sort();
    if (built.length > 0) return join(developmentDistributions, built[built.length - 1]);
  } catch {
    // No local build: Marketplace.
  }
  return MARKETPLACE_URL;
}

/** Puts the plugin in the IDE's plugins folder; the IDE loads it the next time it starts. */
export async function installPlugin(ide: JetBrainsIde, source = MARKETPLACE_URL, extract: Extract = extractZip): Promise<void> {
  const zip = /^https?:/.test(source) ? await download(source) : source;
  try {
    mkdirSync(ide.pluginsDir, { recursive: true });
    rmSync(join(ide.pluginsDir, PLUGIN_FOLDER), { recursive: true, force: true });
    await extract(zip, ide.pluginsDir);
  } finally {
    if (zip !== source) rmSync(zip, { force: true });
  }
}
