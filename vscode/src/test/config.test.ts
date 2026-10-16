import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { configPath, isSignedIn } from '../config';

test('the config lives where tudi-cli and Tudi Desktop put it', () => {
  assert.equal(configPath({}, '/home/ada'), join('/home/ada', '.tudi.cfg'));
  assert.equal(configPath({ TUDI_HOME: '/opt/tudi' }, '/home/ada'), join('/opt/tudi', '.tudi.cfg'));
});

test('signed in only with a key in [settings]', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tudi-vscode-'));
  const file = join(dir, '.tudi.cfg');
  assert.equal(isSignedIn(file), false);
  writeFileSync(file, '[settings]\ndebug = true\n');
  assert.equal(isSignedIn(file), false);
  writeFileSync(file, '[git]\napi_key = nope\n[settings]\napi_key = \n');
  assert.equal(isSignedIn(file), false);
  writeFileSync(file, '[settings]\r\napi_key = 3f2c0c1e-1111-4222-8333-444455556666\r\n');
  assert.equal(isSignedIn(file), true);
});
