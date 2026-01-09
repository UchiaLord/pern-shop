/**
 * Erstellt und konfiguriert die Express-Applikation.
 *
 * Verantwortung:
 * - Initialisiert globale Middleware (Request-ID, JSON-Parser)
 * - Registriert Routen
 * - Registriert 404-Handler und globalen Error-Handler
 *
 * Nicht-Verantwortung:
 * - Startet keinen HTTP-Server (kein listen) -> das macht `server.js`
 */
import 'dotenv/config';
import express from 'express';
import { z } from 'zod';

import { NotFoundError, BadRequestError } from './errors/common.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { validate } from './middleware/validate.js';
import { applySecurityMiddleware } from './middleware/security.js';
import { JSON_BODY_LIMIT } from './config/security.js';
import { createSessionMiddleware } from './middleware/session.js';
import { authRouter } from './routes/auth.js';
import { requireRole } from './middleware/require-role.js';
import { productsRouter } from './routes/products.js';

/**
 * Factory zur Erstellung einer Express-App.
 *
 * @returns {import('express').Express} konfigurierte Express-App
 */
export function createApp() {
  const app = express();

  /**
   * Request-ID Middleware MUSS vor Body-Parsing laufen.
   * Bei kaputtem JSON wollen wir trotzdem eine requestId.
   */
  app.use(requestIdMiddleware);

  // Security BEFORE body parsing & routes
  applySecurityMiddleware(app);

  // JSON Parser mit Limit
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  // Wenn später hinter Proxy:
  app.set('trust proxy', 1);

  // Session Middleware (Postgres Store) MUSS vor /auth liegen
  app.use(createSessionMiddleware());

  // Parser-Fehler (invalid JSON) in unseren Contract übersetzen
  app.use((err, _req, _res, next) => {
    if (err instanceof SyntaxError) {
      return next(new BadRequestError('Ungültiges JSON', err));
    }
    return next(err);
  });

  // Routen
  app.use('/auth', authRouter);
  app.use('/products', productsRouter);

  /**
   * Test-only Route für RBAC.
   * Wird ausschließlich im Test-Modus registriert.
   */

  if (process.env.NODE_ENV === 'test') {
    app.get('/__test__/admin-only', requireRole('admin'), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    app.post('/__test__/set-role', (req, res) => {
      const role = req.body?.role;

      if (!req.session?.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Nicht eingeloggt.' },
        });
      }

      req.session.user.role = role;
      return res.status(200).json({ ok: true, role });
    });
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.post(
    '/echo',
    validate({
      body: z.object({
        message: z.string().min(1),
      }),
    }),
    (req, res) => {
      res.status(200).json({ message: req.body.message });
    },
  );

  app.use((_req, _res, next) => next(new NotFoundError()));
  app.use(errorHandler);

  return app;
}
