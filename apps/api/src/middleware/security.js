/**
 * Security Middleware Bundle.
 *
 * Enthält:
 * - Helmet (Security Headers)
 * - CORS (Whitelist + credentials-ready)
 * - Rate Limiting (global)
 * - HPP Schutz
 * - JSON Body Limit
 *
 * Design:
 * - Als eigene Funktion exportiert, damit app.js nur "useSecurity(app)" macht.
 */

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';

import { CORS_ALLOWED_ORIGINS, RATE_LIMIT } from '../config/security.js';

/**
 * CORS Origin-Check als Callback.
 *
 * Regeln:
 * - Requests ohne Origin (z.B. curl/postman/server-to-server) werden erlaubt.
 * - Browser-CORS wird strikt per Whitelist gesteuert.
 */
function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);

  const allowed = CORS_ALLOWED_ORIGINS.includes(origin);
  return callback(allowed ? null : new Error('CORS blocked'), allowed);
}

/**
 * Wendet alle Security Middleware auf eine Express App an.
 *
 * @param {import('express').Express} app Express App Instanz
 */
export function applySecurityMiddleware(app) {
  // 1) Security Headers
  app.use(
    helmet({
      // CSP in APIs oft deaktiviert, weil es primär HTML schützt.
      // Später, wenn wir SSR/HTML ausliefern, konfigurieren wir CSP sauber.
      contentSecurityPolicy: false
    })
  );

  // 2) HPP Schutz
  app.use(hpp());

  // 3) CORS (Whitelist + credentials-ready)
  app.use(
    cors({
      origin: corsOriginCheck,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
    })
  );

  // 4) Rate Limiting
  app.use(
    rateLimit({
      windowMs: RATE_LIMIT.windowMs,
      max: RATE_LIMIT.max,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  // 5) JSON Body Limit (muss VOR routes laufen)
  app.use((req, res, next) => {
    // Wir setzen nicht direkt express.json hier, sondern konfigurieren das in app.js,
    // damit JSON-Parser-Error Handling dort bleibt. Hier nur "Limit" als Konstante.
    // Diese Middleware ist ein Platzhalter für ein klares Security-Bundle.
    return next();
  });

  // Hinweis: JSON Parser selbst bleibt in app.js, aber mit limit.
  // So behalten wir unsere SyntaxError->BadRequest Übersetzung an einem Ort.
}
