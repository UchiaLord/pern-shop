import express from 'express';
import { z } from 'zod';

import { createUser, findUserByEmail } from '../db/repositories/user-repository.js';
import { requireAuth } from '../middleware/require-auth.js';
import { SESSION_COOKIE_NAME } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';
import { HttpError } from '../errors/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export const authRouter = express.Router();

const registerBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200)
});

const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200)
});

/**
 * Hilfsfunktion: Session regenerieren (Fixation-Schutz) und User in Session setzen.
 * Wichtig: regenerate erst nach erfolgreicher Auth / erfolgreicher User-Erstellung.
 */
function regenerateAndSetUser(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);
      req.session.user = { id: user.id, email: user.email, role: user.role };
      return resolve();
    });
  });
}

/**
 * Für clearCookie sollten die Optionen zur Cookie-Konfiguration passen,
 * sonst bleibt das Cookie evtl. im Browser erhalten (path/sameSite/secure).
 *
 * Achtung: secure nur in production, sonst dev kaputt (http).
 */
function getClearCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  };
}

/**
 * POST /auth/register
 * Legt Nutzer an und loggt ihn direkt ein (Session wird gesetzt).
 */
authRouter.post(
  '/register',
  validate({ body: registerBodySchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Stabiler Contract: 409 wenn bereits vorhanden
    const existing = await findUserByEmail(email);
    if (existing) {
      throw new HttpError({
        status: 409,
        code: 'EMAIL_TAKEN',
        message: 'E-Mail ist bereits registriert.'
      });
    }

    const passwordHash = await hashPassword(password);

    // Race Condition (Unique Violation 23505) wird global gemappt -> EMAIL_TAKEN
    const user = await createUser({ email, passwordHash });

    // Session-Fixation-Schutz auch beim Register
    await regenerateAndSetUser(req, user);

    return res.status(201).json({ user });
  })
);

/**
 * POST /auth/login
 * Authentifiziert und regeneriert die Session (Session-Fixation-Schutz).
 */
authRouter.post(
  '/login',
  validate({ body: loginBodySchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await findUserByEmail(email);
    if (!user) {
      throw new HttpError({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'E-Mail oder Passwort ist falsch.'
      });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new HttpError({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'E-Mail oder Passwort ist falsch.'
      });
    }

    await regenerateAndSetUser(req, user);

    return res.status(200).json({
      user: { id: user.id, email: user.email, role: user.role }
    });
  })
);

/**
 * POST /auth/logout
 * Zerstört die Session (idempotent).
 */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Wenn keine Session existiert: idempotent 204
    if (!req.session) return res.status(204).send();

    // destroy() kann Fehler liefern – wir sind hier bewusst tolerant (idempotent),
    // aber wenn du es strikt willst, kann man next(err) machen.
    await new Promise((resolve) => {
      req.session.destroy(() => resolve());
    });

    // Cookie sicher entfernen (inkl. Optionen)
    res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());

    return res.status(204).send();
  })
);

/**
 * GET /auth/me
 * Liefert den aktuellen Login-State zurück.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.status(200).json({ user: req.session.user });
  })
);