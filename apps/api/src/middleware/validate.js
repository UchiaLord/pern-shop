/**
 * Zod-basierte Validierungs-Middleware.
 *
 * Verantwortung:
 * - Validiert req.body/query/params gegen Zod-Schemas
 * - Ersetzt die Werte durch geparste Werte
 * - Bei Fehler: BadRequestError("Validation failed") mit code=VALIDATION_ERROR + details
 */
import { ZodError } from 'zod';

import { BadRequestError } from '../errors/common.js';

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 * @typedef {import('zod').ZodSchema} ZodSchema
 */

/**
 * @param {ZodError} zerr
 * @returns {Record<string, string>}
 */
function zodIssuesToDetails(zerr) {
  /** @type {Record<string, string>} */
  const details = {};
  for (const issue of zerr.issues) {
    const key = issue.path?.length ? issue.path.join('.') : '_';
    if (!details[key]) details[key] = issue.message;
  }
  return details;
}

/**
 * @param {{ body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }} schemas
 * @returns {RequestHandler}
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new BadRequestError('Validation failed', {
            code: 'VALIDATION_ERROR',
            details: zodIssuesToDetails(err)
          })
        );
      }
      return next(new BadRequestError('Validation failed', err));
    }
  };
}
