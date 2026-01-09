/**
 * Security Middleware Bundle.
 *
 * Enthält:
 * - Helmet (Security Headers)
 * - CORS (Whitelist + credentials-ready)
 * - Rate Limiting (global)
 * - HPP Schutz
 */

import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';

import { CORS_ALLOWED_ORIGINS, RATE_LIMIT } from '../config/security.js';

function normalizeOrigin(origin) {
  if (!origin) return origin;
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}

/**
 * CORS Origin-Check als Callback.
 *
 * Regeln:
 * - Requests ohne Origin (z.B. curl/postman/server-to-server) werden erlaubt.
 * - Browser-CORS wird strikt per Whitelist gesteuert.
 */
function corsOriginCheck(origin, callback) {
  if (!origin) return callback(null, true);

  const normalized = normalizeOrigin(origin);
  const allowed = CORS_ALLOWED_ORIGINS.map(normalizeOrigin).includes(normalized);
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
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id']
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
}
