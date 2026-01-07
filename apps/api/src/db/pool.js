/**
 * PostgreSQL Connection Pool.
 *
 * Verantwortlich für:
 * - Aufbau der DB-Verbindung
 * - Wiederverwendung von Verbindungen
 *
 * Architektur:
 * - Wird von Repositories genutzt
 * - Niemals direkt von Controllern
 */

import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL ist nicht gesetzt');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
