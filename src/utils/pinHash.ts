/**
 * PIN hashing: salted PBKDF2-SHA256 via WebCrypto.
 * Format: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
 * Legacy format (pre-1.x): bare 32-bit base36 string with no `$`.
 *
 * Note: a 4-6 digit PIN is inherently brute-forceable offline (10^6 space);
 * this is a UI lock, not a secret store. Salt + KDF only raise the cost.
 */

const ITERATIONS = 150_000;

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  );
  return b64(new Uint8Array(bits));
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${await derive(pin, salt, ITERATIONS)}`;
}

/** Old weak hash, kept only to verify + migrate existing installs. */
function legacyHash(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith('pbkdf2$');
}

export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  if (isLegacyHash(stored)) return legacyHash(pin) === stored;
  const [, iter, salt, hash] = stored.split('$');
  const iterations = Number(iter);
  if (!iter || !salt || !hash || !Number.isInteger(iterations) || iterations < 1) return false;
  return (await derive(pin, unb64(salt), iterations)) === hash;
}
