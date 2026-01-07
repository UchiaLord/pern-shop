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

/**
 * Factory zur Erstellung einer Express-App.
 *
 * @returns {import('express').Express} konfigurierte Express-App
 */
export function createApp() {
  const app = express();

  app.use(requestIdMiddleware);

  // Security BEFORE body parsing & routes
  applySecurityMiddleware(app);

  // JSON Parser mit Limit
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  /**
   * Request-ID Middleware MUSS vor Body-Parsing laufen.
   *
   * Warum:
   * - Bei kaputtem JSON wirft `express.json()` bevor nachfolgende Middleware läuft.
   * - Wir wollen trotzdem eine requestId für Debugging/Tracing garantieren.
   */
  app.use(requestIdMiddleware);

  /**
   * JSON-Parser für Request Bodies.
   *
   * Hinweis:
   * - Ungültiges JSON löst einen Fehler aus (SyntaxError).
   */
  app.use(express.json());

  /**
   * Parser-Fehler (z. B. invalid JSON) in unseren Contract übersetzen.
   *
   * Wichtig:
   * - Dies ist eine Error-Middleware (4 Parameter), daher greift sie nur bei Fehlern.
   * - Sie muss direkt nach express.json() stehen.
   */

  // Wenn später hinter Proxy (z.B. Render/Fly/NGINX) betrieben:
  // Damit secure cookies korrekt funktionieren.
  app.set('trust proxy', 1);

  // Session Middleware (Postgres Store)
  app.use(createSessionMiddleware());

  app.use((err, _req, _res, next) => {
    if (err instanceof SyntaxError) {
      return next(new BadRequestError('Ungültiges JSON', err));
    }
    return next(err);
  });

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
