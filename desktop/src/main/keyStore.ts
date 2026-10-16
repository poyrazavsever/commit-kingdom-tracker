import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';
import type { Device } from './signIn';

/**
 * The device and its key, encrypted with the operating system's key store (macOS Keychain, Windows DPAPI) through
 * Electron's safeStorage. Nothing is written when that store is unavailable.
 */
const file = () => join(app.getPath('userData'), 'device.bin');

export function loadDevice(): Device | null {
  if (!existsSync(file()) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    const device = JSON.parse(safeStorage.decryptString(readFileSync(file()))) as Device;
    return device.apiKey && device.deviceId ? device : null;
  } catch {
    return null;
  }
}

export function saveDevice(device: Device): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('This computer has no secure key store for Tudi Desktop.');
  writeFileSync(file(), safeStorage.encryptString(JSON.stringify(device)), { mode: 0o600 });
}

export function forgetDevice(): void {
  rmSync(file(), { force: true });
}
