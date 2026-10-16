import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import Module from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

/** Just enough of the VS Code API for activate(): the status bar and the registered commands are what we check. */
const status = { text: '', tooltip: '', command: '', show() {}, dispose() {} };
const commands = new Map<string, () => unknown>();
const opened: string[] = [];
const event = () => ({ dispose() {} });
const fake = {
  StatusBarAlignment: { Left: 1 },
  version: '1.95.0',
  Uri: { parse: (value: string) => value },
  env: { openExternal: async (uri: string) => void opened.push(uri) },
  window: { createStatusBarItem: () => status, onDidChangeActiveTextEditor: event, activeTextEditor: undefined },
  workspace: { getConfiguration: () => ({ get: (_key: string, fallback: string) => (_key === 'cliPath' ? join(tmpdir(), 'no-tudi-cli') : fallback) }), onDidChangeTextDocument: event, onDidSaveTextDocument: event },
  commands: { registerCommand: (name: string, run: () => unknown) => (commands.set(name, run), { dispose() {} }) },
};
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = (request: string, ...rest: unknown[]) => (request === 'vscode' ? fake : load(request, ...rest));

test('without Tudi Desktop the extension asks for setup; once signed in it shows Tudi', async () => {
  const home = mkdtempSync(join(tmpdir(), 'tudi-ext-home-'));
  process.env.TUDI_HOME = home;
  const { activate } = await import('../extension');
  const context = { subscriptions: [] as { dispose(): void }[], extension: { packageJSON: { version: '0.1.0' } } };
  activate(context as never);

  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(status.text, '$(flame) Tudi: set up');
  assert.equal(status.command, 'tudi.setup');
  assert.equal(commands.has('tudi.link'), false);
  await commands.get('tudi.setup')!();
  assert.deepEqual(opened, ['https://tudidaily.com/tracker']);

  // Tudi Desktop signs in; tudi-cli is not installed here, so the status points back to Tudi Desktop.
  writeFileSync(join(home, '.tudi.cfg'), '[settings]\napi_key = 3f2c0c1e-1111-4222-8333-444455556666\n');
  await commands.get('tudi.today')!();
  assert.equal(status.command, 'tudi.today');
  assert.equal(status.text, '$(flame) Tudi');
  assert.match(status.tooltip, /Tudi Desktop/);

  for (const item of context.subscriptions) item.dispose();
});
