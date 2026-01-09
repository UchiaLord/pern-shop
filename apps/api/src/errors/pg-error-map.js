import { HttpError } from './http-error.js';

/**
 * Mappt bekannte Postgres-Fehler auf kanonische HttpErrors.
 * @param {any} err
 * @returns {HttpError | null}
 */
export function mapPgError(err) {
  if (!err || typeof err !== 'object') return null;

  // Unique violation
  if (err.code === '23505') {
    const constraint = String(err.constraint || '');
    const detail = String(err.detail || '').toLowerCase();

    // Email unique
    if (constraint.includes('email') || detail.includes('email')) {
      return new HttpError({
        status: 409,
        code: 'EMAIL_TAKEN',
        message: 'E-Mail ist bereits registriert.',
      });
    }

    // SKU unique
    if (constraint.includes('sku') || detail.includes('sku')) {
      return new HttpError({
        status: 409,
        code: 'SKU_TAKEN',
        message: 'SKU ist bereits vergeben.',
      });
    }

    return new HttpError({
      status: 409,
      code: 'CONFLICT',
      message: 'Conflict',
    });
  }

  // Invalid text representation (z. B. falscher ID-Typ)
  if (err.code === '22P02') {
    return new HttpError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Ungültige Eingabe.',
    });
  }

  return null;
}
