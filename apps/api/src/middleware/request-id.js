/**
 * Middleware zur Erzeugung und Weitergabe einer Request-ID.
 *
 * Verantwortung:
 * - Erzeugt eine eindeutige ID, falls keine vorhanden ist
 * - Speichert die ID in req.requestId
 * - Setzt Response Header x-request-id
 */
import { randomUUID } from 'node:crypto';

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 */

/**
 * Express Request-Erweiterung (nur für Editor-IntelliSense via JSDoc).
 * @typedef {import('express').Request & { requestId?: string }} RequestWithId
 */

/** @type {RequestHandler} */
export const requestIdMiddleware = (req, res, next) => {
  const id = req.headers['x-request-id']?.toString() ?? randomUUID();
  /** @type {RequestWithId} */ (req).requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
