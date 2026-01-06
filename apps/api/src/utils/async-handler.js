/**
 * Hilfsfunktion zur sicheren Behandlung asynchroner Express-Handler.
 *
 * Problem:
 * - Express fängt Promise-Rejections aus async-Handlern nicht zuverlässig ab.
 *
 * Lösung:
 * - Fehler werden an next(err) weitergereicht, damit der globale Error-Handler greift.
 */

/**
 * @typedef {import('express').RequestHandler} RequestHandler
 */

/**
 * @param {(req: any, res: any, next: any) => Promise<unknown>} fn
 * @returns {RequestHandler}
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
