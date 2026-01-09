/**
 * Basis-Typen und -Klassen für HTTP-Fehler.
 *
 * Ziel:
 * - Einheitlicher Fehlervertrag (Error-Contract) für die gesamte API
 * - Mapping: Statuscode + Fehlercode + Message + optionale Details
 */

/**
 * Zentrale Error Codes der API.
 *
 * @typedef {'BAD_REQUEST'
 * |'VALIDATION_ERROR'
 * |'NOT_FOUND'
 * |'UNAUTHENTICATED'
 * |'UNAUTHORIZED'
 * |'FORBIDDEN'
 * |'CONFLICT'
 * |'EMAIL_TAKEN'
 * |'SKU_TAKEN'
 * |'INVALID_CREDENTIALS'
 * |'CART_EMPTY'
 * |'PRODUCT_NOT_FOUND'
 * |'PRODUCT_INACTIVE'
 * |'MIXED_CURRENCY'
 * |'INTERNAL_SERVER_ERROR'} ErrorCode
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
