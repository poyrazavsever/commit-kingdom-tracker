import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pkcePair, newState } from './pkce';

/** This computer as a device of the account; the key is shown once and only Tudi Desktop keeps it. */
export type Device = { deviceId: string; name: string; apiKey: string };

export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in was cancelled.');
  }
}

/** The small pages the browser shows after it hands the answer back. */
export type ReturnPages = { done: string; cancelled: string; failed: string };

export type SignInOptions = {
  apiUrl: string;
  appUrl: string;
  deviceName: string;
  pages: ReturnPages;
  openBrowser: (url: string) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
};

/** The web page that asks the signed-in member to approve this computer (ADR-027). */
export function connectUrl(appUrl: string, request: { challenge: string; redirect: string; state: string; device: string }): string {
  const url = new URL('/desktop/connect', appUrl);
  url.searchParams.set('challenge', request.challenge);
  url.searchParams.set('redirect', request.redirect);
  url.searchParams.set('state', request.state);
  url.searchParams.set('device', request.device);
  return url.toString();
}

/**
 * Signs this computer in (ADR-027): a loopback server on 127.0.0.1 waits for the browser, the member approves on the
 * web, and the one-time code is traded with the PKCE verifier for a device key. Only the code passes through the
 * browser; the key comes straight from the API.
 */
export async function signIn(options: SignInOptions): Promise<Device> {
  const { verifier, challenge } = pkcePair();
  const state = newState();
  const code = await waitForCode(options, challenge, state);
  const response = await (options.fetchImpl ?? fetch)(`${options.apiUrl}/api/tracker/desktop/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier, editor: null }),
    signal: options.signal,
  });
  if (response.status !== 201) throw new Error(`The sign-in could not be completed (${response.status}).`);
  const device = (await response.json()) as Device;
  if (!device.apiKey || !device.deviceId) throw new Error('The sign-in answer was incomplete.');
  return device;
}

function waitForCode(options: SignInOptions, challenge: string, state: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') return reply(response, 404, '');
      // A stale tab or another page: not this sign-in, keep waiting for the real answer.
      if (url.searchParams.get('state') !== state) return reply(response, 400, options.pages.failed);
      const code = url.searchParams.get('code');
      if (code) {
        reply(response, 200, options.pages.done);
        finish(() => resolve(code));
      } else {
        reply(response, 200, options.pages.cancelled);
        finish(() => reject(new SignInCancelled()));
      }
    });

    const timer = setTimeout(() => finish(() => reject(new SignInCancelled())), options.timeoutMs ?? 10 * 60_000);
    const onAbort = () => finish(() => reject(new SignInCancelled()));
    options.signal?.addEventListener('abort', onAbort, { once: true });

    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      server.close();
      server.closeAllConnections();
      settle();
    }

    server.on('error', error => finish(() => reject(error)));
    server.listen(0, '127.0.0.1', async () => {
      const { port } = server.address() as AddressInfo;
      const url = connectUrl(options.appUrl, { challenge, state, redirect: `http://127.0.0.1:${port}/callback`, device: options.deviceName });
      try {
        await options.openBrowser(url);
      } catch (error) {
        finish(() => reject(error));
      }
    });
  });
}

function reply(response: ServerResponse<IncomingMessage>, status: number, message: string): void {
  const body = message
    ? `<!doctype html><meta charset="utf-8"><title>Tudi Desktop</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0"><p>${escapeHtml(message)}</p></body>`
    : '';
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'close' });
  response.end(body);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
}
