/**
 * Passwort-Utility (bcrypt-basiert).
 *
 * Verantwortlichkeiten:
 * - Hashen von Passwörtern
 * - Vergleichen von Klartext vs. Hash
 *
 * Sicherheitsprinzipien:
 * - Niemals Klartext speichern
 * - Konstante Kostenfaktoren
 * - Kein Logging sensibler Daten
 *
 * Architektur:
 * - Wird von Repositories & Controllern genutzt
 * - Enthält keinerlei HTTP- oder DB-Wissen
 */

import bcrypt from 'bcrypt';

/**
 * Work-Factor für bcrypt.
 *
 * Empfehlung:
 * - 10–12 für lokale Entwicklung
 * - 12–14 für Produktion
 *
 * Wichtig:
 * - Muss konstant bleiben, sonst sind Hashes nicht vergleichbar
 */
const BCRYPT_COST = 12;

/**
 * Hasht ein Klartext-Passwort mit bcrypt.
 *
 * @param {string} plainPassword - Passwort im Klartext
 * @returns {Promise<string>} bcrypt-Hash
 *
 * @throws {Error} wenn Passwort leer oder kein String
 */
export async function hashPassword(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
    throw new Error('Passwort muss ein nicht-leerer String sein');
  }

  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

/**
 * Vergleicht ein Klartext-Passwort mit einem bcrypt-Hash.
 *
 * @param {string} plainPassword - vom User eingegebenes Passwort
 * @param {string} passwordHash - gespeicherter Hash aus der DB
 * @returns {Promise<boolean>} true wenn gültig, sonst false
 */
export async function verifyPassword(plainPassword, passwordHash) {
  if (
    typeof plainPassword !== 'string' ||
    typeof passwordHash !== 'string'
  ) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
}
