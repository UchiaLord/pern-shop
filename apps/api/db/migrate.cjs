/**
 * Migration Runner für PostgreSQL (SQL-first, ohne ORM).
 *
 * Ziel:
 * - Migrationen liegen in: apps/api/db/migrations/*.sql
 * - Jede Migration wird genau einmal ausgeführt.
 * - Ausgeführte Migrationen werden in `schema_migrations` protokolliert.
 *
 * Warum SQL-first?
 * - SQL ist die “Quelle der Wahrheit” für Datenmodell/Indizes/Constraints/Trigger
 * - Reviewbar im Git-Diff
 * - Keine versteckte ORM-Magie
 *
 * Warum CommonJS (*.cjs)?
 * - Erzwingt CommonJS unabhängig von `"type": "module"` im Workspace
 * - Vermeidet ESM/CJS-Edgecases unter Windows (Git Bash / pnpm / Node)
 */

const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');

const dotenv = require('dotenv');
const pg = require('pg');

dotenv.config();

const { Client } = pg;

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Listet alle *.sql Migrationen im Migrationsordner auf.
 * Die Sortierung ist lexikografisch — daher 001_, 002_, ...
 * @returns {string[]}
 */
function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Stellt sicher, dass die Tabelle `schema_migrations` existiert (idempotent).
 * @param {import('pg').Client} client
 * @returns {Promise<void>}
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
 * Prüft, ob eine Migration bereits angewendet wurde.
 * @param {import('pg').Client} client
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function isApplied(client, id) {
  const res = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
  return res.rowCount > 0;
}

/**
 * Markiert eine Migration als angewendet.
 * @param {import('pg').Client} client
 * @param {string} id
 * @returns {Promise<void>}
 */
async function markApplied(client, id) {
  await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
}

/**
 * Führt alle ausstehenden Migrationen aus.
 * @returns {Promise<void>}
 */
async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL fehlt. Lege apps/api/.env an (siehe apps/api/.env.example).'
    );
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    throw new Error(`Keine Migrationen gefunden unter: ${MIGRATIONS_DIR}`);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    // Absichtlich sequentiell:
    // Migrationen sollen in fester Reihenfolge laufen und dürfen nicht parallelisiert werden.
    for (const file of files) {
      const id = file;
      console.log(`[migrate] prüfe ${id}`);

 
      const applied = await isApplied(client, id);
      if (applied) {
        console.log(`[migrate] skip ${id}`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      console.log(`[migrate] apply ${id}`);

    
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
