import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { clearCliKey, cliKey, cliPaths, machineId, markAiStart, writeCliKey } from '../main/cliConfig';
import { readIniValue, setIniValues } from '../main/ini';
import { challengeOf, pkcePair } from '../main/pkce';
import { connectUrl, defaultDeviceName, signIn, SignInCancelled } from '../main/signIn';

const pages = { done: 'done', cancelled: 'cancelled', failed: 'failed' };

test('the PKCE challenge is the S256 of the verifier, encoded the way the API checks it', () => {
  const pair = pkcePair();
  // The API's Base64Url: standard base64 with the padding dropped and +/ swapped for -_.
  const server = createHash('sha256').update(pair.verifier, 'ascii').digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(pair.challenge, server);
  assert.match(pair.verifier, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(pair.challenge.length, 43);
  assert.equal(challengeOf(pair.verifier), pair.challenge);
});

test('the connect page gets the challenge, a loopback return address, the state and the computer name', () => {
  const url = new URL(connectUrl('https://app.commitkingdom.com', { challenge: 'c', redirect: 'http://127.0.0.1:5000/callback', state: 's', device: 'Ada’s laptop' }));
  assert.equal(url.pathname, '/desktop/connect');
  assert.equal(url.searchParams.get('redirect'), 'http://127.0.0.1:5000/callback');
  assert.equal(url.searchParams.get('device'), 'Ada’s laptop');
});

/** Plays the browser: approves (or not) by calling the loopback address the connect page was given. */
function browser(answer: (query: URLSearchParams) => Record<string, string>) {
  return async (url: string) => {
    const query = new URL(url).searchParams;
    const back = new URL(query.get('redirect')!);
    for (const [key, value] of Object.entries(answer(query))) back.searchParams.set(key, value);
    setImmediate(() => void fetch(back).catch(() => undefined));
  };
}

test('an approved sign-in trades the code and the verifier for the device key', async () => {
  let sent: { code: string; verifier: string } | undefined;
  let challenge = '';
  const device = await signIn({
    apiUrl: 'http://api.test',
    appUrl: 'http://app.test',
    deviceName: 'Laptop',
    pages,
    openBrowser: browser(query => {
      challenge = query.get('challenge')!;
      return { code: 'one-time', state: query.get('state')! };
    }),
    fetchImpl: (async (url: string, init: RequestInit) => {
      assert.equal(url, 'http://api.test/api/tracker/desktop/token');
      sent = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ deviceId: 'd1', name: 'Laptop', apiKey: 'k1' }), { status: 201 });
    }) as typeof fetch,
  });
  assert.deepEqual(device, { deviceId: 'd1', name: 'Laptop', apiKey: 'k1' });
  assert.equal(sent?.code, 'one-time');
  assert.equal(challengeOf(sent!.verifier), challenge);
});

test('an answer with another state is ignored, and a cancel in the browser stops the sign-in', async () => {
  const calls: string[] = [];
  const result = signIn({
    apiUrl: 'http://api.test',
    appUrl: 'http://app.test',
    deviceName: 'Laptop',
    pages,
    openBrowser: async url => {
      const query = new URL(url).searchParams;
      const back = (extra: string) => `${query.get('redirect')}?${extra}`;
      const forged = await fetch(back('code=stolen&state=wrong'));
      calls.push(`forged ${forged.status}`);
      await fetch(back(`error=access_denied&state=${query.get('state')}`)).catch(() => undefined);
    },
    fetchImpl: (async () => {
      throw new Error('must not exchange');
    }) as typeof fetch,
  });
  await assert.rejects(result, SignInCancelled);
  assert.deepEqual(calls, ['forged 400']);
});

test('cancelling from Tudi Desktop stops waiting', async () => {
  const abort = new AbortController();
  const result = signIn({ apiUrl: 'http://api.test', appUrl: 'http://app.test', deviceName: 'L', pages, signal: abort.signal, openBrowser: () => abort.abort() });
  await assert.rejects(result, SignInCancelled);
});

test('INI updates keep the member’s other settings', () => {
  const before = '[settings]\r\ndebug = true\r\napi_key = old\r\n\r\n[git]\r\ndisable_submodules = true\r\n';
  const after = setIniValues(before, 'settings', { api_key: 'new', api_url: 'http://localhost:5130/api/tracker/v1' });
  assert.equal(after, '[settings]\r\ndebug = true\r\napi_key = new\r\napi_url = http://localhost:5130/api/tracker/v1\r\n\r\n[git]\r\ndisable_submodules = true\r\n');
  assert.equal(setIniValues(after, 'settings', { api_key: null, api_url: null }), '[settings]\r\ndebug = true\r\n\r\n[git]\r\ndisable_submodules = true\r\n');
  assert.equal(setIniValues('', 'internal', { a: '1' }), '[internal]\na = 1\n');
  assert.equal(readIniValue(after, 'settings', 'api_key'), 'new');
  assert.equal(readIniValue(after, 'git', 'api_key'), undefined);
});

test('tudi-cli gets the key in ~/.tudi.cfg and the AI start in ~/.tudi', () => {
  const home = mkdtempSync(join(tmpdir(), 'tudi-desktop-'));
  const paths = cliPaths({}, home);
  assert.equal(paths.config, join(home, '.tudi.cfg'));
  assert.equal(paths.internal, join(home, '.tudi', 'wakatime-internal.cfg'));
  assert.equal(cliPaths({ TUDI_HOME: join(home, 'x') }, home).internal, join(home, 'x', 'wakatime-internal.cfg'));

  writeCliKey(paths, 'key-1', null);
  assert.equal(cliKey(paths), 'key-1');
  assert.equal(readIniValue(readFileSync(paths.config, 'utf8'), 'settings', 'api_url'), undefined);
  markAiStart(paths, new Date('2026-10-16T10:00:00.000Z'));
  assert.equal(readIniValue(readFileSync(paths.internal, 'utf8'), 'internal', 'ai_logs_last_parsed_at'), '2026-10-16T10:00:00.000Z');
  clearCliKey(paths);
  assert.equal(cliKey(paths), undefined);
});

test('the computer gets one random machine id, kept across keys and sign-outs, never the system host name', () => {
  const home = mkdtempSync(join(tmpdir(), 'tudi-machine-'));
  const paths = cliPaths({}, home);
  assert.equal(machineId(paths), undefined);
  writeCliKey(paths, 'key-1', null);
  const id = machineId(paths);
  assert.match(id ?? '', /^ck-[0-9a-f-]{36}$/);
  clearCliKey(paths);
  writeCliKey(paths, 'key-2', null);
  assert.equal(machineId(paths), id);

  // A hostname the member set by hand is not ours: it is replaced by an id.
  writeFileSync(paths.config, setIniValues('', 'settings', { hostname: 'MacBook-Pro' }));
  assert.equal(machineId(paths), undefined);
  writeCliKey(paths, 'key-3', null);
  assert.match(machineId(paths) ?? '', /^ck-/);
});

test('a new computer is named by its kind, never by the system host name', () => {
  assert.equal(defaultDeviceName('win32', true), 'Windows bilgisayar');
  assert.equal(defaultDeviceName('win32', false), 'Windows PC');
  assert.equal(defaultDeviceName('darwin', true), 'Mac');
  assert.equal(defaultDeviceName('linux', false), 'Linux PC');
});
