import assert from 'node:assert/strict';
import { test } from 'node:test';
import { heartbeatArgs } from '../cli';
import { HeartbeatGate, REPEAT_MS } from '../gate';

test('typing in one file sends a heartbeat every two minutes, not on every keystroke', () => {
  const gate = new HeartbeatGate();
  assert.equal(gate.shouldSend('a.ts', false, 0), true);
  assert.equal(gate.shouldSend('a.ts', false, 1_000), false);
  assert.equal(gate.shouldSend('a.ts', false, REPEAT_MS - 1), false);
  assert.equal(gate.shouldSend('a.ts', false, REPEAT_MS), true);
});

test('a save or another file always sends', () => {
  const gate = new HeartbeatGate();
  gate.shouldSend('a.ts', false, 0);
  assert.equal(gate.shouldSend('a.ts', true, 10), true);
  assert.equal(gate.shouldSend('b.ts', false, 20), true);
});

test('the CLI gets the file only as an argument; privacy is the job of the CLI', () => {
  const args = heartbeatArgs('/p/a.ts', true, { cliPath: '', apiUrl: '', plugin: 'vscode/1.95.0 tudi-vscode/0.1.0' });
  assert.deepEqual(args, ['--entity', '/p/a.ts', '--plugin', 'vscode/1.95.0 tudi-vscode/0.1.0', '--write']);
});
