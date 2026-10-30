import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { findJetBrainsIdes, installPlugin, parseFolder, PLUGIN_FOLDER, pluginSource } from '../main/jetbrains';

test('config folders name the product and version', () => {
  assert.deepEqual(parseFolder('PyCharm2025.1'), { product: 'PyCharm', version: [2025, 1] });
  assert.deepEqual(parseFolder('AndroidStudio2025.2.2'), { product: 'AndroidStudio', version: [2025, 2, 2] });
  assert.equal(parseFolder('PermanentDeviceId'), null);
  assert.equal(parseFolder('consentOptions'), null);
  assert.equal(parseFolder('Fleet2025.1'), null);
});

function ide(root: string, folder: string, installed: boolean): void {
  mkdirSync(join(root, 'config', folder), { recursive: true });
  mkdirSync(join(root, 'system', folder), { recursive: true });
  const home = join(root, 'install', folder);
  if (installed) mkdirSync(join(home, 'bin'), { recursive: true });
  if (installed) writeFileSync(join(home, 'bin', 'pycharm64.exe'), '');
  writeFileSync(join(root, 'system', folder, '.home'), home);
}

test('the newest installed and supported version of each IDE is found', () => {
  const root = mkdtempSync(join(tmpdir(), 'tudi-jb-'));
  ide(root, 'PyCharm2024.1', true); // older than the plugin supports
  ide(root, 'PyCharm2025.1', true);
  ide(root, 'PyCharm2025.2', false); // its config is left, the IDE is gone
  ide(root, 'GoLand2024.3', true);
  const found = findJetBrainsIdes({ config: [join(root, 'config')], system: [join(root, 'system')] }, 'win32');
  assert.deepEqual(
    found.map(item => [item.id, item.name, item.pluginsDir, item.hasPlugin]),
    [
      ['jetbrains-goland', 'GoLand', join(root, 'config', 'GoLand2024.3', 'plugins'), false],
      ['jetbrains-pycharm', 'PyCharm', join(root, 'config', 'PyCharm2025.1', 'plugins'), false],
    ],
  );
  assert.equal(found[1].app, join(root, 'install', 'PyCharm2025.1', 'bin', 'pycharm64.exe'));
});

test('installing replaces the plugin folder with the zip’s contents', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tudi-jb-'));
  const pluginsDir = join(root, 'plugins');
  mkdirSync(join(pluginsDir, PLUGIN_FOLDER, 'old'), { recursive: true });
  const calls: [string, string][] = [];
  await installPlugin({ id: 'jetbrains-pycharm', name: 'PyCharm', pluginsDir, app: '', hasPlugin: true }, join(root, 'plugin.zip'), async (zip, into) => {
    calls.push([zip, into]);
    mkdirSync(join(into, PLUGIN_FOLDER, 'lib'), { recursive: true });
  });
  assert.deepEqual(calls, [[join(root, 'plugin.zip'), pluginsDir]]);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(join(pluginsDir, PLUGIN_FOLDER, 'old')), false);
  assert.equal(existsSync(join(pluginsDir, PLUGIN_FOLDER, 'lib')), true);
});

test('the plugin comes from the bundled zip, then a local build, then Marketplace', () => {
  const root = mkdtempSync(join(tmpdir(), 'tudi-jb-src-'));
  const resources = join(root, 'resources');
  const built = join(root, 'distributions');
  assert.match(pluginSource(resources, built, {}), /^https:\/\/plugins\.jetbrains\.com\//);
  mkdirSync(built, { recursive: true });
  writeFileSync(join(built, `${PLUGIN_FOLDER}-0.1.0.zip`), '');
  assert.equal(pluginSource(resources, built, {}), join(built, `${PLUGIN_FOLDER}-0.1.0.zip`));
  mkdirSync(join(resources, 'extensions'), { recursive: true });
  writeFileSync(join(resources, 'extensions', `${PLUGIN_FOLDER}.zip`), '');
  assert.equal(pluginSource(resources, built, {}), join(resources, 'extensions', `${PLUGIN_FOLDER}.zip`));
  assert.equal(pluginSource(resources, built, { TUDI_JETBRAINS_ZIP: '/x.zip' }), '/x.zip');
});
