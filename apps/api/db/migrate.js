/**
 * Migration Runner für PostgreSQL.
 *
 * Prinzip:
 * - SQL-Dateien liegen in db/migrations und werden lexikografisch ausgeführt (001_, 002_, ...)
 * - In schema_migrations speichern wir, welche Migrationen bereits angewandt wurden.
 *
 * Warum ohne ORM?
 * - Maximale Transparenz
 * - SQL ist "source of truth"
 * - Leicht zu reviewen (Git Diff)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Liefert alle Migration-Dateinamen (.sql) sortiert.
 * @returns {string[]}
 */
function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Stellt sicher, dass die schema_migrations Tabelle existiert.
 * (Falls 001_init.sql sie schon erstellt: trotzdem harmlos.)
 * @param {pg.Client} client
 */
async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/**
 * Prüft, ob eine Migration bereits angewandt wurde.
 * @param {pg.Client} client
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function isApplied(client, id) {
  const res = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
  return res.rowCount > 0;
}

/**
 * Markiert eine Migration als angewandt.
 * @param {pg.Client} client
 * @param {string} id
 */
async function markApplied(client, id) {
  await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
}

/**
 * Führt alle nicht angewandten Migrationen aus.
 */
async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL fehlt. Lege apps/api/.env an (siehe .env.example).');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const files = listMigrationFiles();

    for (const file of files) {
      const id = file;
     
      console.log(`[migrate] prüfe ${id} ...`);

    
      const applied = await isApplied(client, id);
      if (applied) {
     
        console.log(`[migrate] skip ${id} (bereits angewandt)`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      console.log(`[migrate] apply ${id}`);

      // Jede Migration soll selbst BEGIN/COMMIT enthalten (wie unsere Dateien).
      // Dadurch ist das Verhalten transparent und SQL-first.
     
      await client.query(sql);


      await markApplied(client, id);

      console.log(`[migrate] done ${id}`);
    }

    console.log('[migrate] fertig');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('[migrate] ERROR', err);
  process.exitCode = 1;
});
