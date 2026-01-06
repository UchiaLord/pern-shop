/**
 * Globaler Express Error-Handler.
 *
 * Verantwortung:
 * - Serialisiert bekannte HttpError in den kanonischen Error-Contract
 * - Fallback auf 500 für unbekannte Fehler
 * - Verhindert Stacktrace-Leaks
 */
import { HttpError } from '../errors/http-error.js';

/**
 * @typedef {import('express').ErrorRequestHandler} ErrorRequestHandler
 */

/** @type {ErrorRequestHandler} */
export const errorHandler = (err, req, res, next) => {
  void next; // dokumentiert: Express erwartet 4 Params, next wird nicht genutzt
  const requestId = req.requestId;
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details
      }
    });
  }

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId
    }
  });
};
