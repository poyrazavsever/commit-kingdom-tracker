import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { EXTENSION_ID, findVisualStudios, installVsix, vsixSource } from '../main/visualStudio';

const instance = (id: string, version: string) => ({
  instanceId: id,
  displayName: `Visual Studio Community ${version.startsWith('18') ? '2026' : '2022'}`,
  installationPath: join('C:', 'VS', id),
  productPath: join('C:', 'VS', id, 'Common7', 'IDE', 'devenv.exe'),
  installationVersion: version,
});

test('every Visual Studio 2022+ installation is found, with whether it has the extension', async () => {
  const local = mkdtempSync(join(tmpdir(), 'ck-vs-'));
  const installed = join(local, 'Microsoft', 'VisualStudio', '17.0_aaaa1111', 'Extensions', 'x1y2z3');
  mkdirSync(installed, { recursive: true });
  writeFileSync(join(installed, 'extension.vsixmanifest'), `<Identity Id="${EXTENSION_ID}" Version="0.1.0" />`);
  const other = join(local, 'Microsoft', 'VisualStudio', '18.0_bbbb2222', 'Extensions', 'q');
  mkdirSync(other, { recursive: true });
  writeFileSync(join(other, 'extension.vsixmanifest'), '<Identity Id="Someone.Else" />');

  const found = await findVisualStudios('win32', async () => JSON.stringify([instance('aaaa1111', '17.14.36414.22'), instance('bbbb2222', '18.0.11111.1')]), local);

  assert.deepEqual(found.map(vs => [vs.id, vs.hasExtension]), [['visualstudio-aaaa1111', true], ['visualstudio-bbbb2222', false]]);
  assert.equal(found[0].installer, join('C:', 'VS', 'aaaa1111', 'Common7', 'IDE', 'VSIXInstaller.exe'));
});

test('no Visual Studio outside Windows, and broken vswhere output finds none', async () => {
  assert.deepEqual(await findVisualStudios('darwin', async () => '[]', ''), []);
  assert.deepEqual(await findVisualStudios('win32', async () => 'not json', ''), []);
});

test('the VSIX installs quietly into that one installation', async () => {
  const calls: string[][] = [];
  const [vs] = await findVisualStudios('win32', async () => JSON.stringify([instance('aaaa1111', '17.14.0')]), '');
  const vsix = join('C:', 'ck', 'commit-kingdom-visualstudio.vsix');
  await installVsix(vs, vsix, async (installer, args) => void calls.push([installer, ...args]));
  assert.deepEqual(calls, [[vs.installer, '/quiet', '/instanceIds:aaaa1111', vsix]]);
});

test('the bundled VSIX wins over a local build; neither means Visual Studio is not offered', () => {
  const resources = mkdtempSync(join(tmpdir(), 'ck-res-'));
  assert.equal(vsixSource(resources, join(resources, 'missing.vsix'), {}), null);
  mkdirSync(join(resources, 'extensions'));
  writeFileSync(join(resources, 'extensions', 'commit-kingdom-visualstudio.vsix'), '');
  assert.equal(vsixSource(resources, join(resources, 'missing.vsix'), {}), join(resources, 'extensions', 'commit-kingdom-visualstudio.vsix'));
  assert.equal(vsixSource(resources, 'x', { TUDI_VISUALSTUDIO_VSIX: 'own.vsix' }), 'own.vsix');
});
