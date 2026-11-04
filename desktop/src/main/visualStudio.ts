import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The extension's id in visualstudio/source.extension.vsixmanifest. */
export const EXTENSION_ID = 'CommitKingdom.Tracker.VisualStudio';
/** The file Desktop carries in resources/extensions (scripts/build-visualstudio.mjs). */
export const VSIX_FILE = 'commit-kingdom-visualstudio.vsix';

export type VisualStudio = {
  id: `visualstudio-${string}`;
  name: string;
  instanceId: string;
  /** devenv.exe, for the icon. */
  app: string;
  /** Common7\IDE\VSIXInstaller.exe of this installation. */
  installer: string;
  hasExtension: boolean;
};

type Instance = { instanceId: string; displayName: string; installationPath: string; productPath: string; installationVersion: string };

export type RunVsWhere = () => Promise<string>;

const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');

const runVsWhere: RunVsWhere = () =>
  new Promise(resolve => {
    if (!existsSync(vswhere)) return resolve('[]');
    execFile(vswhere, ['-products', '*', '-version', '[17.0,19.0)', '-format', 'json', '-utf8'], { timeout: 20_000, windowsHide: true }, (error, stdout) =>
      resolve(error ? '[]' : stdout),
    );
  });

/**
 * Visual Studio 2022 and later on Windows, found with vswhere (it ships with every installation). Each installation
 * keeps its own extensions under `%LOCALAPPDATA%\Microsoft\VisualStudio\<major>.0_<instanceId>\Extensions`, where an
 * installed extension leaves its extension.vsixmanifest.
 */
export async function findVisualStudios(
  platform: NodeJS.Platform = process.platform,
  run: RunVsWhere = runVsWhere,
  localAppData = process.env.LOCALAPPDATA ?? '',
): Promise<VisualStudio[]> {
  if (platform !== 'win32') return [];
  let instances: Instance[];
  try {
    instances = JSON.parse(await run()) as Instance[];
  } catch {
    return [];
  }
  return instances.map(instance => {
    const major = instance.installationVersion.split('.')[0];
    return {
      id: `visualstudio-${instance.instanceId}` as const,
      name: instance.displayName,
      instanceId: instance.instanceId,
      app: instance.productPath,
      installer: join(instance.installationPath, 'Common7', 'IDE', 'VSIXInstaller.exe'),
      hasExtension: hasExtension(join(localAppData, 'Microsoft', 'VisualStudio', `${major}.0_${instance.instanceId}`, 'Extensions')),
    };
  });
}

/** Whether one of the extension folders holds our manifest (installed folders get random names). */
export function hasExtension(extensionsDir: string): boolean {
  try {
    return readdirSync(extensionsDir, { withFileTypes: true }).some(entry => {
      if (!entry.isDirectory()) return false;
      try {
        return readFileSync(join(extensionsDir, entry.name, 'extension.vsixmanifest'), 'utf8').includes(`Id="${EXTENSION_ID}"`);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Packaged Desktop carries the VSIX; a local build uses visualstudio/bin/Release. TUDI_VISUALSTUDIO_VSIX overrides both.
 * Null when there is none (the extension is not on the Visual Studio Marketplace yet).
 */
export function vsixSource(resources: string, developmentBuild: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.TUDI_VISUALSTUDIO_VSIX) return env.TUDI_VISUALSTUDIO_VSIX;
  const bundled = join(resources, 'extensions', VSIX_FILE);
  if (existsSync(bundled)) return bundled;
  return existsSync(developmentBuild) ? developmentBuild : null;
}

export type RunInstaller = (installer: string, args: string[]) => Promise<void>;

const runInstaller: RunInstaller = (installer, args) =>
  new Promise((resolve, reject) => {
    execFile(installer, args, { timeout: 5 * 60_000, windowsHide: true }, error => (error ? reject(error) : resolve()));
  });

/**
 * Installs the VSIX into this installation, silently, for this user. Visual Studio loads it the next time it starts;
 * an open Visual Studio is left alone.
 */
export function installVsix(vs: VisualStudio, vsix: string, run: RunInstaller = runInstaller): Promise<void> {
  return run(vs.installer, ['/quiet', `/instanceIds:${vs.instanceId}`, vsix]);
}
