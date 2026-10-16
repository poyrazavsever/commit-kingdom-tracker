// Builds tudi-cli (../cli) into resources/bin/<platform>-<arch>/ for Tudi Desktop to carry.
// Usage: node scripts/build-cli.mjs [platform-arch ...]   e.g. win32-x64 darwin-arm64 darwin-x64 (default: this machine)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, '..', 'cli');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const goos = { win32: 'windows', darwin: 'darwin', linux: 'linux' };
const goarch = { x64: 'amd64', arm64: 'arm64' };

const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [`${process.platform}-${process.arch}`];
for (const target of targets) {
  const [platform, arch] = target.split('-');
  if (!goos[platform] || !goarch[arch]) throw new Error(`Unknown target ${target}`);
  const out = join(root, 'resources', 'bin', target, platform === 'win32' ? 'tudi-cli.exe' : 'tudi-cli');
  execFileSync('go', ['build', '-trimpath', '-ldflags', `-s -w -X github.com/wakatime/wakatime-cli/pkg/version.Version=v${version}-tudi`, '-o', out, '.'], {
    cwd: cli,
    stdio: 'inherit',
    env: { ...process.env, GOOS: goos[platform], GOARCH: goarch[arch], CGO_ENABLED: '0' },
  });
  console.log(`tudi-cli ${target} → ${out}`);
}
