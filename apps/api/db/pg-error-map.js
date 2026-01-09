import { HttpError } from './http-error.js';

/**
 * @param {any} err
 * @returns {HttpError | null}
 */
export function mapPgError(err) {
  if (!err || typeof err !== 'object') return null;

  // Unique violation
  if (err.code === '23505') {
    const constraint = String(err.constraint || '');
    const detail = String(err.detail || '').toLowerCase();

    if (constraint.includes('email') || detail.includes('email')) {
      return new HttpError({
        status: 409,
        code: 'EMAIL_TAKEN',
        message: 'Email is already registered'
      });
    }

    if (constraint.includes('sku') || detail.includes('sku')) {
      return new HttpError({
        status: 409,
        code: 'SKU_TAKEN',
        message: 'SKU is already in use'
      });
    }

    return new HttpError({
      status: 409,
      code: 'CONFLICT',
      message: 'Conflict'
    });
  }

  // Invalid text representation (common for bad ids)
  if (err.code === '22P02') {
    return new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid input syntax'
    });
  }

  return null;
}
