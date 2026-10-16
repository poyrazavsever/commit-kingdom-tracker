import { createHash, randomBytes } from 'node:crypto';

/** A PKCE pair (RFC 7636, S256): the verifier stays in Tudi Desktop, only the challenge goes to the browser. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: challengeOf(verifier) };
}

export function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** Ties the browser's answer to this sign-in, so another page cannot hand Tudi Desktop a code. */
export function newState(): string {
  return randomBytes(24).toString('base64url');
}
