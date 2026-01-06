/**
 * Zentrale Security-Konfiguration.
 *
 * Ziel:
 * - Security Defaults sind an einer Stelle definiert (auditierbar).
 * - app.js bleibt ein Wiring/Composition Layer.
 *
 * Hinweis:
 * - Werte sind bewusst konservativ gewählt und können später pro Environment angepasst werden.
 */

/**
 * Erlaubte Origins für CORS.
 *
 * Warum Whitelist:
 * - Für Cookies/Sessions (credentials) darf man nicht "*" verwenden.
 * - Whitelist erzwingt, dass nur bekannte Frontends zugreifen.
 */
export const CORS_ALLOWED_ORIGINS = [
  'http://localhost:5173', // Vite dev (Frontend, später anpassen)
  'http://localhost:3000' // optional: falls du CRA/andere nutzt
];

/**
 * Maximale JSON Body-Größe.
 *
 * Warum:
 * - Schutz vor Payload-Bombs (z.B. 50MB JSON).
 * - Für einen Webshop reichen typische Bodies deutlich kleiner.
 */
export const JSON_BODY_LIMIT = '100kb';

/**
 * Globales Rate Limiting (Baseline).
 *
 * Warum:
 * - Schutz gegen Flooding / einfache DoS-Versuche.
 * - Später können wir pro Route (Auth, Checkout) strengere Limits setzen.
 */
export const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 200
};
