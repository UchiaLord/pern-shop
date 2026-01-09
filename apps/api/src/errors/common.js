import { HttpError } from './http-error.js';

export class BadRequestError extends HttpError {
  /**
   * @param {string} message
   * @param {any=} meta - kann { code, details } oder ein cause sein
   */
  constructor(message = 'Bad request', meta) {
    const code = meta?.code || 'BAD_REQUEST';
    const details = meta?.details;

    super({
      status: 400,
      code,
      message,
      details
    });

    this.cause = meta;
  }
}

export class NotFoundError extends HttpError {
  /**
   * @param {string=} message
   */
  constructor(message = 'Not found') {
    super({
      status: 404,
      code: 'NOT_FOUND',
      message
    });
  }
}
