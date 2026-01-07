/**
 * User Repository.
 *
 * Verantwortlichkeiten:
 * - Zugriff auf users, roles, user_roles
 * - Keine HTTP- oder Session-Logik
 *
 * Rückgabeprinzip:
 * - Plain Objects
 * - Keine DB-spezifischen Typen
 */

import { pool } from '../pool.js';

/**
 * Erstellt einen neuen Benutzer.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.passwordHash
 * @returns {Promise<{id:number,email:string}>}
 */
export async function createUser({ email, passwordHash }) {
  const res = await pool.query(
    `
    INSERT INTO users (email, password_hash)
    VALUES ($1, $2)
    RETURNING id, email
    `,
    [email, passwordHash],
  );

  return res.rows[0];
}

/**
 * Findet einen Benutzer anhand der E-Mail.
 *
 * @param {string} email
 * @returns {Promise<null|{id:number,email:string,passwordHash:string}>}
 */
export async function findUserByEmail(email) {
  const res = await pool.query(
    `
    SELECT id, email, password_hash
    FROM users
    WHERE email = $1 AND is_active = true
    `,
    [email],
  );

  if (res.rowCount === 0) return null;

  return {
    id: res.rows[0].id,
    email: res.rows[0].email,
    passwordHash: res.rows[0].password_hash,
  };
}

/**
 * Lädt einen Benutzer inkl. Rollen.
 *
 * @param {number} userId
 * @returns {Promise<null|{id:number,email:string,roles:string[]}>}
 */
export async function getUserWithRoles(userId) {
  const res = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      r.key AS role
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1 AND u.is_active = true
    `,
    [userId],
  );

  if (res.rowCount === 0) return null;

  return {
    id: res.rows[0].id,
    email: res.rows[0].email,
    roles: res.rows.map((r) => r.role).filter(Boolean),
  };
}
