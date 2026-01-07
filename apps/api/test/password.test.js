import { describe, it, expect } from 'vitest';

import { hashPassword, verifyPassword } from '../src/utils/password.js';

describe('Password Utility', () => {
  it('hasht ein Passwort', async () => {
    const hash = await hashPassword('super-secret');

    expect(hash).toBeTypeOf('string');
    expect(hash).not.toBe('super-secret');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifiziert korrektes Passwort', async () => {
    const password = 'correct-horse-battery-staple';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('verweigert falsches Passwort', async () => {
    const hash = await hashPassword('original-password');

    const isValid = await verifyPassword('wrong-password', hash);
    expect(isValid).toBe(false);
  });

  it('wirft Fehler bei leerem Passwort', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });
});
