import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bundledCli, ensureCli } from '../main/cliInstall';
import { editorCandidates, EXTENSION_ID, extensionSource, findEditors, installExtension } from '../main/editors';

test('tudi-cli is installed, kept, and replaced when Tudi Desktop carries a new one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tudi-cli-'));
  assert.equal(bundledCli('/r', 'win32', 'x64'), join('/r', 'bin', 'win32-x64', 'tudi-cli.exe'));
  const bundled = join(dir, 'bundle', 'tudi-cli');
  const target = join(dir, 'home', '.tudi', 'tudi-cli');
  assert.equal(ensureCli(bundled, target), 'missing');

  mkdirSync(join(dir, 'bundle'));
  writeFileSync(bundled, 'v1');
  assert.equal(ensureCli(bundled, target), 'installed');
  assert.equal(readFileSync(target, 'utf8'), 'v1');
  assert.equal(ensureCli(bundled, target), 'current');

  writeFileSync(bundled, 'v2');
  assert.equal(ensureCli(bundled, target), 'updated');
  assert.equal(readFileSync(target, 'utf8'), 'v2');
  assert.equal(existsSync(`${target}.old`), false);
  assert.equal(existsSync(`${target}.new`), false);
});

test('editors are found by install location, and the extension is looked for in each', async () => {
  const local = mkdtempSync(join(tmpdir(), 'tudi-editors-'));
  const vscode = join(local, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd');
  const cursor = join(local, 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd');
  for (const file of [vscode, cursor]) {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, '');
  }
  const candidates = editorCandidates('win32', { LOCALAPPDATA: local, ProgramFiles: join(local, 'none') }, local);
  assert.deepEqual(candidates.map(editor => [editor.id, editor.cli]), [['vscode', vscode], ['cursor', cursor]]);
  assert.deepEqual(candidates.map(editor => editor.app), [join(local, 'Programs', 'Microsoft VS Code', 'Code.exe'), join(local, 'Programs', 'cursor', 'Cursor.exe')]);

  const calls: string[][] = [];
  const run = async (cli: string, args: string[]) => {
    calls.push([cli, ...args]);
    if (cli === cursor) throw new Error('broken launcher');
    return `ms-python.python\r\n${EXTENSION_ID.toUpperCase()}\r\n`;
  };
  const editors = await findEditors(run, candidates);
  assert.deepEqual(editors.map(editor => [editor.id, editor.hasExtension]), [['vscode', true], ['cursor', false]]);

  await installExtension(candidates[1], run, 'C:\dev\tudi-tracker.vsix').catch(() => undefined);
  assert.deepEqual(calls.at(-1), [cursor, '--install-extension', 'C:\dev\tudi-tracker.vsix', '--force']);
  assert.deepEqual(editorCandidates('linux', {}, local), []);
});

test('the extension installer prefers an override, then the carried or development VSIX, before the marketplace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tudi-vsix-'));
  const resources = join(dir, 'resources');
  const development = join(dir, 'vscode', 'tudi-tracker.vsix');
  assert.equal(extensionSource(resources, development, {}), EXTENSION_ID);

  mkdirSync(join(development, '..'), { recursive: true });
  writeFileSync(development, 'dev');
  assert.equal(extensionSource(resources, development, {}), development);

  const bundled = join(resources, 'extensions', 'tudi-tracker.vsix');
  mkdirSync(join(bundled, '..'), { recursive: true });
  writeFileSync(bundled, 'bundle');
  assert.equal(extensionSource(resources, development, {}), bundled);
  assert.equal(extensionSource(resources, development, { TUDI_VSIX: 'C:\\override.vsix' }), 'C:\\override.vsix');
});
