import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { test } from 'node:test';
import { findAiTools } from '../main/aiTools';

const home = join('/home', 'ada');

test('an AI tool is listed when its logs are on the computer, in a fixed order', () => {
  const present = new Set([join(home, '.codex', 'sessions'), join(home, '.claude', 'projects'), join(home, '.gemini', 'antigravity-ide')]);
  const tools = findAiTools(home, {}, path => present.has(path));
  assert.deepEqual(tools.map(tool => tool.id), ['claude-code', 'codex', 'antigravity-agent']);
});

test('a moved config folder is followed and an empty variable is ignored', () => {
  const custom = join('/data', 'claude');
  assert.deepEqual(findAiTools(home, { CLAUDE_CONFIG_DIR: custom }, path => path === custom).map(tool => tool.name), ['Claude Code']);
  assert.deepEqual(findAiTools(home, { CODEX_HOME: '' }, path => path === ''), []);
});

test('a computer without AI tools lists none', () => {
  assert.deepEqual(findAiTools(home, {}, () => false), []);
});
