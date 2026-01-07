/**
 * Session-Middleware (express-session + connect-pg-simple).
 *
 * Zweck:
 * - Session Authentication serverseitig (Cookie enthält nur Session-ID)
 * - Session-Daten liegen in PostgreSQL (skalierbar, restart-sicher)
 *
 * Security Defaults:
 * - httpOnly Cookie (JS im Browser kann Cookie nicht lesen)
 * - sameSite=lax (Basis-CSRF-Schutz, ohne normale Navigation zu brechen)
 * - secure Cookie in Produktion (nur via HTTPS)
 *
 * Betrieb:
 * - In Prod (hinter Proxy/Load Balancer) muss "trust proxy" gesetzt sein,
 *   sonst erkennt Express HTTPS nicht korrekt und secure cookies werden nicht gesetzt.
 */

import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { pool } from '../db/pool.js';

const PgSession = connectPgSimple(session);

/**
 * Einheitlicher Cookie-Name für Sessions.
 *
 * Warum:
 * - Logout muss exakt den gleichen Cookie-Namen löschen, den express-session setzt.
 * - Wenn du den Cookie-Namen später änderst, musst du ihn nur an einer Stelle anpassen.
 */
export const SESSION_COOKIE_NAME = 'pern.sid';

/**
 * Erzeugt die konfigurierte Session-Middleware.
 *
 * @param {Object} [opts]
 * @param {string} [opts.cookieName] - Cookie-Name (Default: SESSION_COOKIE_NAME)
 * @returns {import('express').RequestHandler}
 */
export function createSessionMiddleware(opts = {}) {
  const cookieName = opts.cookieName ?? SESSION_COOKIE_NAME;

  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET fehlt. Lege ihn in apps/api/.env fest.');
  }

  const isProd = process.env.NODE_ENV === 'production';

  return session({
    name: cookieName,

    // Secret für das Signieren des Session-Cookies (nicht das Session-Objekt)
    secret: process.env.SESSION_SECRET,

    // Session nicht neu speichern, wenn unverändert
    resave: false,

    // Keine leeren Sessions erzeugen (weniger DB-Spam)
    saveUninitialized: false,

    // Postgres-Store statt MemoryStore
    store: new PgSession({
      pool,
      tableName: 'session',

      // Optional: Auto-Cleanup abgelaufener Sessions
      // pruneSessionInterval: 60, // Sekunden; optional aktivieren, wenn gewünscht
    }),

    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd, // in Prod: nur HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
    },
  });
}
