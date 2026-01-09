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

function parseCsv(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Erlaubte Origins für CORS.
 *
 * Überschreibbar via ENV:
 * - CORS_ALLOWED_ORIGINS="https://shop.example.com,https://admin.example.com"
 */
export const CORS_ALLOWED_ORIGINS =
  parseCsv(process.env.CORS_ALLOWED_ORIGINS).length > 0
    ? parseCsv(process.env.CORS_ALLOWED_ORIGINS)
    : [
        'http://localhost:5173', // Vite dev
        'http://localhost:3000'
      ];

/**
 * Maximale JSON Body-Größe.
 *
 * Überschreibbar via ENV:
 * - JSON_BODY_LIMIT="200kb"
 */
export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '100kb';

/**
 * Globales Rate Limiting (Baseline).
 *
 * Überschreibbar via ENV:
 * - RATE_LIMIT_WINDOW_MS="900000"
 * - RATE_LIMIT_MAX="200"
 */
export const RATE_LIMIT = {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 200)
};

/**
 * Trust Proxy Setting (für Secure Cookies hinter Proxy/Load Balancer).
 *
 * Überschreibbar via ENV:
 * - TRUST_PROXY="1"  (oder "true")
 */
export const TRUST_PROXY =
  (process.env.TRUST_PROXY ?? '').toLowerCase() === 'true' ||
  process.env.TRUST_PROXY === '1';
