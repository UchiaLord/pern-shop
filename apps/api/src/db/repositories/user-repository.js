import { pool } from '../pool.js';

/**
 * Legt einen Benutzer an und weist ihm die Default-Rolle "customer" zu.
 */
export async function createUser({ email, passwordHash }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1) User anlegen
    const userResult = await client.query(
      `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email
      `,
      [email, passwordHash],
    );

    const user = userResult.rows[0];

    // 2) Default-Rolle "customer" holen
    const roleResult = await client.query(
      `
      SELECT id, key
      FROM roles
      WHERE key = 'customer'
      LIMIT 1
      `,
    );

    if (roleResult.rowCount === 0) {
      throw new Error('Default-Rolle "customer" existiert nicht.');
    }

    const role = roleResult.rows[0];

    // 3) Rolle zuweisen
    await client.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      `,
      [user.id, role.id],
    );

    await client.query('COMMIT');

    return {
      id: user.id,
      email: user.email,
      role: role.key,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Findet einen Benutzer inkl. Rolle anhand der E-Mail.
 */
export async function findUserByEmail(email) {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.password_hash,
      r.key AS role
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.email = $1
    LIMIT 1
    `,
    [email],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role ?? null,
  };
}
