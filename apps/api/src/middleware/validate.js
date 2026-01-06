/**
 * Zod-basierte Validierungs-Middleware.
 *
 * Verantwortung:
 * - Validiert req.body/query/params gegen Zod-Schemas
 * - Ersetzt die Werte durch geparste Werte
 * - Bei Fehler: BadRequestError("Validation failed")
 */
import { BadRequestError } from '../errors/common.js';

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 * @typedef {import('zod').ZodSchema} ZodSchema
 */

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
      next(new BadRequestError('Validation failed', err));
    }
  };
}
