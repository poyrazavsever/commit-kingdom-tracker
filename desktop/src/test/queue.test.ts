import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SYNC_EVERY_MS, syncAi, syncDue, syncQueue } from '../main/queue';

test('the offline queue is sent at most as often as tudi-cli itself sends', () => {
  assert.equal(syncDue(0, SYNC_EVERY_MS), true);
  assert.equal(syncDue(1_000, 1_000 + SYNC_EVERY_MS - 1), false);
  assert.equal(syncDue(1_000, 1_000 + SYNC_EVERY_MS), true);
});

test('sending the queue runs tudi-cli with the sync flag and never throws', async () => {
  const calls: { file: string; args: string[] }[] = [];
  await syncQueue('/home/ada/.tudi/tudi-cli', 'tudi-desktop/0.1.0', async (file, args) => void calls.push({ file, args }));
  assert.deepEqual(calls, [{ file: '/home/ada/.tudi/tudi-cli', args: ['--sync-offline-activity', '1000', '--plugin', 'tudi-desktop/0.1.0'] }]);
  await syncQueue('/missing/tudi-cli', 'tudi-desktop/0.1.0');
});

test('the AI tools are read without an editor, and a failure never throws', async () => {
  const calls: { file: string; args: string[]; timeoutMs: number }[] = [];
  await syncAi('/home/ada/.tudi/tudi-cli', 'tudi-desktop/0.2.0', async (file, args, timeoutMs) => void calls.push({ file, args, timeoutMs }));
  assert.deepEqual(calls, [{ file: '/home/ada/.tudi/tudi-cli', args: ['--sync-ai-activity', '--plugin', 'tudi-desktop/0.2.0'], timeoutMs: 120_000 }]);
  await syncAi('/missing/tudi-cli', 'tudi-desktop/0.2.0');
});
