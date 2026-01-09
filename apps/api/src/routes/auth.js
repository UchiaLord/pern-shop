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

    req.session.user = { id: user.id, email: user.email, role: user.role };

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

    await new Promise((resolve, reject) => {
      req.session.regenerate((regenErr) => {
        if (regenErr) return reject(regenErr);
        return resolve();
      });
    });

    req.session.user = { id: user.id, email: user.email, role: user.role };

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
    if (!req.session) return res.status(204).send();

    await new Promise((resolve) => {
      req.session.destroy(() => resolve());
    });

    res.clearCookie(SESSION_COOKIE_NAME);
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
