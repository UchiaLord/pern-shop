import express from 'express';

import {
  createUser,
  findUserByEmail,
} from '../db/repositories/user-repository.js';
import { requireAuth } from '../middleware/require-auth.js';
import { SESSION_COOKIE_NAME } from '../middleware/session.js';
import { asyncHandler } from '../utils/async-handler.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export const authRouter = express.Router();

/**
 * Sehr einfache Validierung, damit wir unabhängig von einer evtl. bestehenden validate.js bleiben.
 * Später kann man das konsolidieren.
 */
function validateRegisterBody(body) {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const details = {};
  if (!email) details.email = 'E-Mail ist erforderlich.';
  if (email && email.length > 254) details.email = 'E-Mail ist zu lang.';
  if (email && !/^\S+@\S+\.\S+$/.test(email))
    details.email = 'E-Mail ist ungültig.';

  if (!password) details.password = 'Passwort ist erforderlich.';
  if (password && password.length < 10)
    details.password = 'Passwort muss mindestens 10 Zeichen haben.';
  if (password && password.length > 200)
    details.password = 'Passwort ist zu lang.';

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }

  return { ok: true, email, password };
}

function validateLoginBody(body) {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const details = {};
  if (!email) details.email = 'E-Mail ist erforderlich.';
  if (email && email.length > 254) details.email = 'E-Mail ist zu lang.';
  if (email && !/^\S+@\S+\.\S+$/.test(email))
    details.email = 'E-Mail ist ungültig.';

  if (!password) details.password = 'Passwort ist erforderlich.';
  if (password && password.length > 200)
    details.password = 'Passwort ist zu lang.';

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }

  return { ok: true, email, password };
}



/**
 * POST /auth/register
 * Legt Nutzer an und loggt ihn direkt ein (Session wird gesetzt).
 */
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const validated = validateRegisterBody(req.body);
    if (!validated.ok) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ungültige Eingaben.',
          details: validated.details,
        },
      });
    }

    const passwordHash = await hashPassword(validated.password);

    try {
      const user = await createUser({ email: validated.email, passwordHash });

      // Session setzen (direkt eingeloggt)
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      return res.status(201).json({ user });
    } catch (err) {
      // Postgres unique violation -> Email bereits vergeben
      if (err && typeof err === 'object' && err.code === '23505') {
        return res.status(409).json({
          error: {
            code: 'EMAIL_TAKEN',
            message: 'E-Mail ist bereits registriert.',
          },
        });
      }
      throw err;
    }
  }),
);

/**
 * POST /auth/login
 * Authentifiziert und regeneriert die Session (Session-Fixation-Schutz).
 */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const validated = validateLoginBody(req.body);
    if (!validated.ok) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ungültige Eingaben.',
          details: validated.details,
        },
      });
    }

    const user = await findUserByEmail(validated.email);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-Mail oder Passwort ist falsch.',
        },
      });
    }

    const ok = await verifyPassword(validated.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-Mail oder Passwort ist falsch.',
        },
      });
    }

    // Session regeneration (wichtig)
    await new Promise((resolve, reject) => {
      req.session.regenerate((regenErr) => {
        if (regenErr) return reject(regenErr);
        return resolve();
      });
    });

    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return res.status(200).json({
      user: { id: user.id, email: user.email, role: user.role },
    });
  }),
);

/**
 * POST /auth/logout
 * Zerstört die Session (idempotent).
 */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (!req.session) return res.status(204).send();

    await new Promise((resolve) => {
      req.session.destroy(() => resolve());
    });

    // Optional: Cookie „hart“ löschen (Name hängt von session.js ab).
    // Wenn du in session.js z.B. name: 'sid' gesetzt hast, dann hier 'sid' verwenden.
    res.clearCookie(SESSION_COOKIE_NAME);

    return res.status(204).send();
  }),
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
  }),
);
