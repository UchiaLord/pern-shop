/**
 * Globaler Express Error-Handler.
 *
 * Verantwortung:
 * - Serialisiert bekannte HttpError in den kanonischen Error-Contract
 * - Mappt bekannte Postgres-Fehler in HttpError (z. B. 23505 -> 409)
 * - Fallback auf 500 für unbekannte Fehler
 * - Verhindert Stacktrace-Leaks
 */
import { HttpError } from '../errors/http-error.js';
import { mapPgError } from '../errors/pg-error-map.js';

/**
 * @typedef {import('express').ErrorRequestHandler} ErrorRequestHandler
 */

/** @type {ErrorRequestHandler} */
export const errorHandler = (err, req, res, next) => {
  void next; // dokumentiert: Express erwartet 4 Params, next wird nicht genutzt
  const requestId = req.requestId;

  const mapped = mapPgError(err);
  if (mapped) err = mapped;

  if (err instanceof HttpError) {
    const payload = {
      error: {
        code: err.code,
        message: err.message,
        requestId
      }
    };

    if (err.details !== undefined) payload.error.details = err.details;

    return res.status(err.status).json(payload);
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId
    }
  });
};
