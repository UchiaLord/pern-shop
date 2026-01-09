// apps/api/src/lib/errors.js
export class AppError extends Error {
  /**
   * @param {object} args
   * @param {string} args.code
   * @param {number} args.status
   * @param {string} args.message
   * @param {Record<string,string>=} args.details
   */
  constructor({ code, status, message, details }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createError(code, status, message, details) {
  return new AppError({ code, status, message, details });
}
