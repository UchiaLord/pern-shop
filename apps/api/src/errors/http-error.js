/**
 * Basis-Typen und -Klassen für HTTP-Fehler.
 *
 * Ziel:
 * - Einheitlicher Fehlervertrag (Error-Contract) für die gesamte API
 * - Mapping: Statuscode + Fehlercode + Message + optionale Details
 */

/**
 * @typedef {'BAD_REQUEST'|'NOT_FOUND'|'UNAUTHORIZED'|'FORBIDDEN'|'CONFLICT'|'INTERNAL_SERVER_ERROR'} ErrorCode
 */

/**
 * Kanonisches Fehlerformat der API.
 *
 * @typedef {Object} ApiErrorResponse
 * @property {{code: ErrorCode, message: string, requestId?: string, details?: unknown}} error
 */

/**
 * Basisklasse für "operative" HTTP-Fehler.
 * Operativ = erwartbar/handhabbar (z. B. Validierung, NotFound).
 */
export class HttpError extends Error {
  /**
   * @param {{status: number, code: ErrorCode, message: string, details?: unknown}} opts
   */
  constructor(opts) {
    super(opts.message);
    /** @type {number} */
    this.status = opts.status;
    /** @type {ErrorCode} */
    this.code = opts.code;
    /** @type {unknown | undefined} */
    this.details = opts.details;
  }
}
