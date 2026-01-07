-- 005_sessions.sql
--
-- Legt die Tabelle für express-session (connect-pg-simple) an.
-- Speichert Sessions serverseitig in PostgreSQL, statt im Memory-Store.
-- Das ist produktionsfähig (skaliert horizontal) und vermeidet Datenverlust bei Restarts.

CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE "session"
  ADD CONSTRAINT "session_pkey"
  PRIMARY KEY ("sid")
  NOT DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
