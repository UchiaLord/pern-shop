/**
 * Session-Middleware (express-session + connect-pg-simple).
 *
 * Zweck:
 * - Session Authentication serverseitig (Cookie enthält nur Session-ID)
 * - Session-Daten liegen in PostgreSQL (skalierbar, restart-sicher)
 *
 * Security Defaults:
 * - httpOnly Cookie (JS im Browser kann Cookie nicht lesen)
 * - sameSite=lax (Basis-CSRF-Schutz)
 * - secure Cookie in Produktion (nur via HTTPS)
 *
 * Hinweis:
 * - Wenn sameSite='none' genutzt wird (Cross-Site Cookies), MUSS secure=true sein.
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { pool } from '../db/pool.js';

const PgSession = connectPgSimple(session);

export const SESSION_COOKIE_NAME = 'pern.sid';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
const SESSION_MAX_AGE_MS = ONE_DAY_MS * 7;

function resolveSameSite() {
  const raw = (process.env.SESSION_SAMESITE ?? '').toLowerCase();
  if (raw === 'none') return 'none';
  if (raw === 'strict') return 'strict';
  return 'lax';
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.cookieName] - Cookie-Name (Default: SESSION_COOKIE_NAME)
 * @returns {import('express').RequestHandler}
 */
export function createSessionMiddleware(opts = {}) {
  const cookieName = opts.cookieName ?? SESSION_COOKIE_NAME;

  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET fehlt. Lege ihn als ENV-Variable fest.');
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  /** @type {'lax'|'strict'|'none'} */
  const sameSite = resolveSameSite();

  // Browser requirement: sameSite=none requires secure cookies
  const secure = sameSite === 'none' ? true : isProd;

  return session({
    name: cookieName,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    store: new PgSession({
      pool,
      tableName: 'session'
    }),

    cookie: {
      // Wichtig für res.clearCookie(): path muss matchen
      path: '/',
      httpOnly: true,
      sameSite,
      secure,
      maxAge: SESSION_MAX_AGE_MS
    }
  });
}