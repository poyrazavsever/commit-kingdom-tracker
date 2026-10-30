// Builds the JetBrains plugin (../jetbrains) into resources/extensions/ for Commit Kingdom Desktop to carry.
// Usage: node scripts/build-jetbrains.mjs [path/to/plugin.zip]   (a zip already built elsewhere, e.g. by CI, is copied)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = resolve(root, '..', 'jetbrains');
let zip = process.argv[2];
if (!zip) {
  execFileSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['buildPlugin'], { cwd: plugin, stdio: 'inherit', shell: process.platform === 'win32' });
  const out = join(plugin, 'build', 'distributions');
  const built = readdirSync(out).filter(name => name.endsWith('.zip')).sort();
  zip = join(out, built[built.length - 1]);
}
mkdirSync(join(root, 'resources', 'extensions'), { recursive: true });
const target = join(root, 'resources', 'extensions', 'tudi-tracker-jetbrains.zip');
copyFileSync(zip, target);
console.log(`JetBrains plugin → ${target}`);
