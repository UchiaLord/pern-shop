BEGIN;

-- Sicherstellen, dass keine Dubletten existieren (optional, falls schon Daten da sind).
-- In einem frischen Dev-System ist das irrelevant.

-- Unique-Index auf lower(email) für case-insensitive E-Mail-Unique.
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON users (lower(email));

COMMIT;
