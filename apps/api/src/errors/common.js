/**
 * Häufig verwendete Fehlerklassen (Typed Errors).
 *
 * Zweck:
 * - Konsistente Fehlererzeugung ohne Magic Numbers/Strings in Routen
 */
import { HttpError } from './http-error.js';

/**
 * 400 Bad Request.
 * Typische Fälle: Validierungsfehler, semantisch ungültige Eingaben.
 */
export class BadRequestError extends HttpError {
  /**
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(message = 'Bad request', details) {
    super({ status: 400, code: 'BAD_REQUEST', message, details });
  }
}

/**
 * 404 Not Found.
 * Typische Fälle: Unbekannte Route oder Ressource existiert nicht.
 */
export class NotFoundError extends HttpError {
  /**
   * @param {string} [message]
   * @param {unknown} [details]
   */
  constructor(message = 'Not found', details) {
    super({ status: 404, code: 'NOT_FOUND', message, details });
  }
}
