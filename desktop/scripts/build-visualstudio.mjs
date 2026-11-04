// Builds the Visual Studio extension (../visualstudio) into resources/extensions/ for Commit Kingdom Desktop to carry.
// Windows only: it needs Visual Studio's MSBuild, found with vswhere. Elsewhere it does nothing (Desktop lists
// Visual Studio only on Windows).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.log('Visual Studio extension: skipped (not Windows)');
  process.exit(0);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(root, '..', 'visualstudio');
const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
if (!existsSync(vswhere)) throw new Error('vswhere.exe not found: install Visual Studio 2022 or its Build Tools');
const msbuild = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-find', 'MSBuild/**/Bin/MSBuild.exe'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .find(Boolean);
if (!msbuild) throw new Error('MSBuild not found');
execFileSync(msbuild, ['CommitKingdom.VisualStudio.csproj', '-restore', '-p:Configuration=Release', '-v:minimal', '-nologo'], { cwd: project, stdio: 'inherit' });
mkdirSync(join(root, 'resources', 'extensions'), { recursive: true });
const target = join(root, 'resources', 'extensions', 'commit-kingdom-visualstudio.vsix');
copyFileSync(join(project, 'bin', 'Release', 'CommitKingdom.VisualStudio.vsix'), target);
console.log(`Visual Studio extension → ${target}`);
